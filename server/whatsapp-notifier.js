/**
 * WhatsApp Cloud API - Notificador de Devocionales
 * Iglesia RIO Internacional
 *
 * Envía notificaciones WhatsApp cuando el devocional diario está disponible.
 * Lee la lista de suscriptores desde data/whatsapp-subscribers.json
 */

const fs = require('fs');
const path = require('path');

const SUBSCRIBERS_FILE = path.join(__dirname, '..', 'data', 'whatsapp-subscribers.json');

// ─── Helpers ───────────────────────────────────────────────────────────────

function loadSubscribers() {
    try {
        if (!fs.existsSync(SUBSCRIBERS_FILE)) {
            fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([], null, 2));
            return [];
        }
        return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    } catch (err) {
        console.error('[WhatsApp] Error cargando suscriptores:', err.message);
        return [];
    }
}

function saveSubscribers(list) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(list, null, 2));
}

function addSubscriber(phone, name = '') {
    const list = loadSubscribers();
    const clean = phone.replace(/\D/g, '');
    if (!list.find(s => s.phone === clean)) {
        list.push({ phone: clean, name: name || 'Hermano/a', addedAt: new Date().toISOString() });
        saveSubscribers(list);
        return true;
    }
    return false; // ya existe
}

function removeSubscriber(phone) {
    const list = loadSubscribers();
    const clean = phone.replace(/\D/g, '');
    const filtered = list.filter(s => s.phone !== clean);
    saveSubscribers(filtered);
    return filtered.length < list.length;
}

// ─── Envío por template ────────────────────────────────────────────────────

/**
 * Envía el template rio_notificacion con parámetros NAMED:
 *   {{tipo}}    - Tipo de mensaje (ej: "Devocional del día")
 *   {{nombre}}  - Nombre del destinatario
 *   {{mensaje}} - Cuerpo del mensaje / versículo
 *   {{fecha}}   - Fecha y hora del evento
 *   {{detalle}} - Detalle adicional / lugar
 */
async function sendTemplateMessage(phone, { nombre, tipo, mensaje, fecha, detalle }) {
    const token    = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneId  = process.env.WHATSAPP_CLOUD_PHONE_ID;
    const version  = process.env.WHATSAPP_CLOUD_API_VERSION || 'v21.0';
    const template = process.env.WHATSAPP_TEMPLATE_NAME || 'rio_notificacion';
    const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es';

    if (!token || !phoneId) {
        console.warn('[WhatsApp] Faltan credenciales (WHATSAPP_CLOUD_TOKEN / WHATSAPP_CLOUD_PHONE_ID)');
        return { ok: false, error: 'missing_credentials' };
    }

    const body = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: template,
            language: { code: language },
            components: [{
                type: 'body',
                parameters: [
                    { type: 'text', parameter_name: 'tipo',    text: tipo    },
                    { type: 'text', parameter_name: 'nombre',  text: nombre  },
                    { type: 'text', parameter_name: 'mensaje', text: mensaje },
                    { type: 'text', parameter_name: 'fecha',   text: fecha   },
                    { type: 'text', parameter_name: 'detalle', text: detalle }
                ]
            }]
        }
    };

    try {
        const res = await fetch(
            `https://graph.facebook.com/${version}/${phoneId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        const data = await res.json();
        if (!res.ok) {
            return { ok: false, error: data?.error?.message || 'api_error', code: data?.error?.code };
        }
        return { ok: true, messageId: data?.messages?.[0]?.id };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// ─── Función principal ─────────────────────────────────────────────────────

/**
 * Envía notificación WhatsApp a todos los suscriptores activos.
 * @param {string} date    - Fecha del devocional (YYYY-MM-DD)
 * @param {string} title   - Título del devocional
 * @param {string} appUrl  - URL base de la app (ej: https://devocionales.rioiglesia.com)
 */
async function sendWhatsAppDevotionalNotification(date, title, appUrl) {
    const subscribers = loadSubscribers();

    if (subscribers.length === 0) {
        console.log('[WhatsApp] No hay suscriptores, se omite envío');
        return { sent: 0, failed: 0, total: 0 };
    }

    const link = appUrl ? `${appUrl}/?date=${date}` : `https://devocionales.rioiglesia.com/?date=${date}`;
    console.log(`[WhatsApp] Enviando devocional "${title}" (${date}) a ${subscribers.length} suscriptores...`);

    // Formatear fecha en español: "jueves 24 de abril, 6:00 AM"
    const fechaFormateada = new Date(date + 'T06:00:00').toLocaleDateString('es', {
        weekday: 'long', day: 'numeric', month: 'long'
    }) + ', 6:00 AM';

    const params = {
        tipo:    'Devocional del día',
        mensaje: title || 'Escucha el devocional de hoy 🎧',
        fecha:   fechaFormateada,
        detalle: link
    };

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
        const result = await sendTemplateMessage(sub.phone, { ...params, nombre: sub.name || 'Hermano/a' });
        if (result.ok) {
            sent++;
            console.log(`[WhatsApp] ✓ Enviado a ${sub.phone} (${sub.name})`);
        } else {
            failed++;
            console.warn(`[WhatsApp] ✗ Error en ${sub.phone}: ${result.error} (código ${result.code || '-'})`);
        }
        // Pausa de 300ms entre envíos para respetar rate limits
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[WhatsApp] Resultado: ${sent} enviados, ${failed} fallidos de ${subscribers.length} total`);
    return { sent, failed, total: subscribers.length };
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
    sendWhatsAppDevotionalNotification,
    addSubscriber,
    removeSubscriber,
    loadSubscribers,
    saveSubscribers
};

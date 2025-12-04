/**
 * Script de Prueba de Estrés - RIO Devocionales
 * Simula múltiples usuarios conectándose y reproduciendo audio simultáneamente
 */

const BASE_URL = 'https://devocionales.164.68.118.86.sslip.io';
const AUDIO_DATE = '2025-12-04'; // Fecha del audio a probar

// Configuración de pruebas
const TESTS = [
    { users: 100, name: 'Prueba 100' },
    { users: 200, name: 'Prueba 200' },
    { users: 300, name: 'Prueba 300' },
    { users: 400, name: 'Prueba 400' },
    { users: 500, name: 'Prueba 500' }
];

// Estadísticas
let stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    errors: []
};

// Simular una solicitud de usuario
async function simulateUser(userId) {
    const startTime = Date.now();
    
    try {
        // 1. Cargar página principal
        const pageResponse = await fetch(BASE_URL, {
            headers: { 'User-Agent': `StressTest-User-${userId}` }
        });
        
        if (!pageResponse.ok) throw new Error(`Page load failed: ${pageResponse.status}`);
        
        // 2. Obtener info del devocional
        const devotionalResponse = await fetch(`${BASE_URL}/api/devotional/${AUDIO_DATE}`);
        
        // 3. Solicitar el audio (HEAD para no descargar todo)
        const audioResponse = await fetch(`${BASE_URL}/audios/${AUDIO_DATE}.mp3`, {
            method: 'HEAD'
        });
        
        if (!audioResponse.ok) throw new Error(`Audio not found: ${audioResponse.status}`);
        
        // 4. Simular streaming parcial del audio (primeros bytes)
        const audioStreamResponse = await fetch(`${BASE_URL}/audios/${AUDIO_DATE}.mp3`, {
            headers: { 'Range': 'bytes=0-65535' } // Primeros 64KB
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        stats.totalRequests++;
        stats.successfulRequests++;
        stats.responseTimes.push(responseTime);
        
        return { success: true, userId, responseTime };
        
    } catch (error) {
        const endTime = Date.now();
        stats.totalRequests++;
        stats.failedRequests++;
        stats.errors.push({ userId, error: error.message });
        
        return { success: false, userId, error: error.message, responseTime: endTime - startTime };
    }
}

// Ejecutar prueba con N usuarios
async function runTest(numUsers, testName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 ${testName}: ${numUsers} usuarios simultáneos`);
    console.log(`${'='.repeat(60)}`);
    
    // Resetear estadísticas
    stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: []
    };
    
    const startTime = Date.now();
    
    // Crear todas las promesas de usuarios
    const userPromises = [];
    for (let i = 1; i <= numUsers; i++) {
        userPromises.push(simulateUser(i));
    }
    
    // Ejecutar todas en paralelo
    console.log(`⏳ Iniciando ${numUsers} conexiones simultáneas...`);
    const results = await Promise.all(userPromises);
    
    const totalTime = Date.now() - startTime;
    
    // Calcular estadísticas
    const avgResponseTime = stats.responseTimes.length > 0 
        ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
        : 0;
    const minResponseTime = stats.responseTimes.length > 0 ? Math.min(...stats.responseTimes) : 0;
    const maxResponseTime = stats.responseTimes.length > 0 ? Math.max(...stats.responseTimes) : 0;
    const successRate = ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1);
    
    // Mostrar resultados
    console.log(`\n📊 RESULTADOS:`);
    console.log(`   Tiempo total: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log(`   Usuarios: ${numUsers}`);
    console.log(`   ✅ Exitosos: ${stats.successfulRequests}`);
    console.log(`   ❌ Fallidos: ${stats.failedRequests}`);
    console.log(`   📈 Tasa de éxito: ${successRate}%`);
    console.log(`\n⏱️  Tiempos de respuesta:`);
    console.log(`   Mínimo: ${minResponseTime}ms`);
    console.log(`   Promedio: ${avgResponseTime}ms`);
    console.log(`   Máximo: ${maxResponseTime}ms`);
    
    if (stats.errors.length > 0 && stats.errors.length <= 10) {
        console.log(`\n⚠️  Errores (primeros 10):`);
        stats.errors.slice(0, 10).forEach(e => {
            console.log(`   Usuario ${e.userId}: ${e.error}`);
        });
    } else if (stats.errors.length > 10) {
        console.log(`\n⚠️  ${stats.errors.length} errores totales (mostrando tipos únicos):`);
        const uniqueErrors = [...new Set(stats.errors.map(e => e.error))];
        uniqueErrors.forEach(e => console.log(`   - ${e}`));
    }
    
    // Evaluación
    console.log(`\n🏆 EVALUACIÓN:`);
    if (successRate >= 99 && avgResponseTime < 1000) {
        console.log(`   ✅ EXCELENTE - El servidor maneja bien ${numUsers} usuarios`);
    } else if (successRate >= 95 && avgResponseTime < 2000) {
        console.log(`   ✅ BUENO - Rendimiento aceptable con ${numUsers} usuarios`);
    } else if (successRate >= 90) {
        console.log(`   ⚠️  ACEPTABLE - Algunos problemas con ${numUsers} usuarios`);
    } else {
        console.log(`   ❌ PROBLEMAS - El servidor tiene dificultades con ${numUsers} usuarios`);
    }
    
    return {
        testName,
        numUsers,
        totalTime,
        successRate: parseFloat(successRate),
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        failed: stats.failedRequests
    };
}

// Ejecutar todas las pruebas
async function runAllTests() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     🔥 PRUEBA DE ESTRÉS - RIO DEVOCIONALES                   ║
║     URL: ${BASE_URL}                      
║     Audio: ${AUDIO_DATE}.mp3                                  ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    
    const results = [];
    
    for (const test of TESTS) {
        const result = await runTest(test.users, test.name);
        results.push(result);
        
        // Pausa entre pruebas para que el servidor se recupere
        if (TESTS.indexOf(test) < TESTS.length - 1) {
            console.log(`\n⏸️  Pausa de 5 segundos antes de la siguiente prueba...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    // Resumen final
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 RESUMEN FINAL`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n| Usuarios | Éxito % | Tiempo Prom. | Tiempo Max | Fallidos |`);
    console.log(`|----------|---------|--------------|------------|----------|`);
    results.forEach(r => {
        console.log(`| ${r.numUsers.toString().padStart(8)} | ${r.successRate.toFixed(1).padStart(7)}% | ${(r.avgResponseTime + 'ms').padStart(12)} | ${(r.maxResponseTime + 'ms').padStart(10)} | ${r.failed.toString().padStart(8)} |`);
    });
    
    console.log(`\n✅ Pruebas completadas`);
}

// Ejecutar prueba individual
async function runSingleTest(numUsers) {
    await runTest(numUsers, `Prueba con ${numUsers} usuarios`);
}

// Exportar funciones
module.exports = { runAllTests, runSingleTest, runTest };

// Si se ejecuta directamente
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === '--users' && args[1]) {
        runSingleTest(parseInt(args[1]));
    } else {
        runAllTests();
    }
}

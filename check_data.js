const db = require('./database/pg-database');

async function checkAndCreateSampleData() {
    try {
        // Verificar observaciones existentes
        const observations = await db.getRecentObservations(5);
        console.log('Observaciones existentes:', observations.length);
        
        if (observations.length > 0) {
            console.log('\nÚltima observación:');
            console.log('- ID:', observations[0].id);
            console.log('- Child ID:', observations[0].child_id);
            console.log('- Observer:', observations[0].observer_name);
            console.log('- Description:', observations[0].description);
        }
        
        // Verificar niños
        const children = await db.getAllChildren();
        console.log('\nNiños registrados:', children.length);
        
        if (children.length > 0) {
            console.log('Primer niño:', children[0].name, children[0].last_name);
        }
        
        // Verificar usuarios
        console.log('\nVerificando usuarios...');
        // No podemos acceder directamente a getUsers, pero podemos verificar la estructura
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAndCreateSampleData();

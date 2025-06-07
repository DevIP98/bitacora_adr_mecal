const db = require('./database/database');

async function createTestObservation() {
    try {
        await db.initDatabase();
        
        // Crear un niño de prueba si no existe
        const testChild = {
            name: 'Juan',
            last_name: 'Pérez',
            age: 8,
            birthdate: '2017-01-15',
            group_name: 'Primarios',
            parent_name: 'María Pérez',
            parent_phone: '555-1234',
            parent_email: 'maria@example.com'
        };
        
        const childId = await db.createChild(testChild);
        console.log('Niño creado/encontrado con ID:', childId);
        
        // Crear observación de prueba con preguntas reflexivas
        const testObservation = {
            child_id: childId,
            observer_id: 1, // Asumiendo que existe el admin con ID 1
            observation_date: '2025-06-07',
            observation_types: JSON.stringify(['Comportamiento', 'Participación en la clase']),
            description: 'El niño mostró una excelente participación durante la clase.\n\n--- Preguntas reflexivas ---\n\n🔶 ¿Qué te gusta hacer con tu familia?\nRespuesta: Me gusta jugar fútbol con mi papá y ver películas con mi mamá\n\n🔶 ¿Cómo te sientes cuando estás en el salón con tus compañeros?\nRespuesta: Me siento muy feliz porque tengo muchos amigos aquí',
            tags: JSON.stringify(['Positivo']),
            talked_with_child: 1,
            prayed_for_issue: 0,
            notified_parents: 0,
            requires_followup: 0,
            additional_comments: 'Continuar observando su progreso'
        };
        
        const observationId = await db.createObservation(testObservation);
        console.log('Observación de prueba creada con ID:', observationId);
        
        // Verificar que se guardó correctamente
        const observations = await db.getObservationsByChild(childId);
        console.log('\nObservación guardada:', observations[0].description);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

createTestObservation();

const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');

// Configurar Handlebars con los mismos helpers
const hbs = exphbs.create({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: {
        formatQuestionsAndAnswers: function(description) {
            console.log('🔍 formatQuestionsAndAnswers recibió:', description);
            if (!description) return '';
            
            // Revisar si contiene formato de preguntas (🔶 y "Respuesta:")
            if (description.includes('🔶') && description.includes('Respuesta:')) {
                console.log('✅ Detectado formato de preguntas reflexivas');
                // Dividir por el delimitador 🔶
                const parts = description.split('🔶');
                
                let html = '';
                
                // El primer elemento puede ser texto inicial
                if (parts[0].trim()) {
                    // Verificar si tiene el separador de preguntas reflexivas
                    let initialText = parts[0].trim();
                    if (initialText.includes('--- Preguntas reflexivas ---')) {
                        const textParts = initialText.split('--- Preguntas reflexivas ---');
                        if (textParts[0].trim()) {
                            html += `<div class="mb-3"><strong>Observación directa:</strong><br>${textParts[0].trim().replace(/\n/g, '<br>')}</div>`;
                        }
                    } else {
                        html += `<p>${initialText.replace(/\n/g, '<br>')}</p>`;
                    }
                }
                
                // Procesar cada pregunta y respuesta
                for (let i = 1; i < parts.length; i++) {
                    const part = parts[i].trim();
                    if (!part) continue;
                    
                    // Buscar "Respuesta:" para separar pregunta y respuesta
                    const respuestaIndex = part.indexOf('Respuesta:');
                    
                    if (respuestaIndex !== -1) {
                        const question = part.substring(0, respuestaIndex).trim();
                        const answer = part.substring(respuestaIndex + 10).trim(); // 10 = "Respuesta:".length
                        
                        html += '<div class="question-item">';
                        html += `<div class="question"><strong>🔶 ${question}</strong></div>`;
                        if (answer) {
                            html += `<div class="answer"><strong>Respuesta:</strong> ${answer.replace(/\n/g, '<br>')}</div>`;
                        }
                        html += '</div>';
                    } else {
                        // Si no hay formato "Respuesta:", mostrar como pregunta sin respuesta
                        html += '<div class="question-item">';
                        html += `<div class="question"><strong>🔶 ${part.replace(/\n/g, '<br>')}</strong></div>`;
                        html += '</div>';
                    }
                }
                
                console.log('🎯 HTML generado:', html);
                return html;
            } else {
                console.log('❌ No es formato de preguntas, retornando texto normal');
                // No es formato de preguntas, devolver texto normal con saltos de línea
                return description.replace(/\n/g, '<br>');
            }
        },
        
        // Helper para detectar si el texto tiene formato de preguntas
        hasQuestionFormat: function(text) {
            const hasFormat = text && text.includes('🔶') && text.includes('Respuesta:');
            console.log('🔍 hasQuestionFormat para:', text ? text.substring(0, 50) + '...' : 'null', 'Resultado:', hasFormat);
            return hasFormat;
        }
    }
});

// Datos de prueba
const testDescription = `🔶 ¿Qué te gusta hacer con tu familia?
Respuesta: comer y jugar
🔶 ¿Qué te pone triste a veces?
Respuesta: jugar solo
🔶 ¿Qué haces cuando alguien que quieres está triste?
Respuesta: lo abrazo`;

console.log('=== TEST DE HELPERS ===');
console.log('Datos de entrada:', testDescription);
console.log('\n=== RESULTADO hasQuestionFormat ===');
const hasFormat = hbs.handlebars.helpers.hasQuestionFormat(testDescription);

console.log('\n=== RESULTADO formatQuestionsAndAnswers ===');
const formattedResult = hbs.handlebars.helpers.formatQuestionsAndAnswers(testDescription);

console.log('\n=== RESULTADO FINAL ===');
console.log(formattedResult);

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Bitácora ADR - Sistema de Registro para Ministerio Infantil

## Descripción del Proyecto
Este es un sistema web desarrollado en Node.js para el registro y seguimiento de observaciones en el ministerio infantil. Permite a los maestros y líderes documentar comportamientos, actitudes espirituales y necesidades especiales de los niños.

## Tecnologías Utilizadas
- **Backend**: Node.js con Express
- **Base de datos**: SQLite3
- **Frontend**: Handlebars (HBS) templates
- **CSS Framework**: Bootstrap 5
- **Autenticación**: Express-session con bcryptjs
- **Iconos**: Bootstrap Icons

## Estructura del Proyecto
- `app.js` - Archivo principal del servidor
- `database/` - Módulos de base de datos
- `routes/` - Rutas del servidor (auth, children, dashboard, observations)
- `views/` - Plantillas Handlebars
- `public/` - Archivos estáticos (CSS, JS, imágenes)

## Características Principales
1. **Sistema de autenticación** para maestros/líderes
2. **Gestión de niños** con información completa
3. **Registro de observaciones** con tipos predefinidos
4. **Dashboard** con estadísticas y resúmenes
5. **Diseño responsive** para móvil y PC
6. **Interfaz en español**

## Convenciones de Código
- Usar ES6+ cuando sea posible
- Manejar errores adecuadamente con try-catch
- Comentarios en español
- Nombres de variables y funciones en inglés
- Mensajes de usuario en español
- Validación tanto en frontend como backend

## Base de Datos
- Usar SQLite3 para persistencia
- Relaciones entre usuarios, niños y observaciones
- Campos JSON para arrays (tipos de observación, etiquetas)
- Timestamps automáticos

## Funcionalidades Específicas
- **Tipos de observación**: Participación, Comportamiento, Actitud espiritual, Relación con otros, Necesidades especiales
- **Etiquetas**: Positivo, Para seguimiento, Alerta
- **Acciones de seguimiento**: Conversación, Oración, Notificación a padres, Seguimiento futuro
- **Sistema de roles**: Admin y Teacher

## Mejores Prácticas
- Sanitizar inputs del usuario
- Usar prepared statements para SQL
- Implementar validación de formularios
- Responsive design first
- Accesibilidad web
- Seguridad en sesiones

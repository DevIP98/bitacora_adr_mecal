# 📖 Bitácora ADR - Sistema de Registro para Ministerio Infantil

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## 🎯 Descripción

Sistema web desarrollado para el registro y seguimiento de observaciones en el ministerio infantil. Permite a maestros y líderes documentar de manera organizada el comportamiento, desarrollo emocional y espiritual de los niños.

## 🌐 Demo en Vivo

**URL de Producción**: [https://bitacora-adr-mecal.onrender.com](https://bitacora-adr-mecal.onrender.com)

## ✨ Características Principales

- 🔐 **Sistema de autenticación** simplificado con registro directo integrado
- 👶 **Gestión completa de niños** con información personal y de contacto
- 📝 **Registro detallado de observaciones** con tipos predefinidos y validación
- 💡 **Preguntas sugeridas** para conversaciones reflexivas con los niños (17 preguntas organizadas por categorías)
- 📊 **Dashboard** con estadísticas y resúmenes
- 📱 **Diseño responsive** optimizado para móvil y PC con animaciones modernas
- 🇪🇸 **Interfaz completamente en español**
- ✅ **Validación de formularios** tanto en frontend como backend
- 🎨 **Interfaz moderna** con gradientes, animaciones y efectos visuales

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **Base de datos**: SQLite3
- **Frontend**: Handlebars (HBS)
- **Estilos**: Bootstrap 5 + CSS personalizado
- **Autenticación**: Express-session + bcryptjs
- **Iconos**: Bootstrap Icons

## 📋 Requisitos

- Node.js 14 o superior
- npm o yarn

## 🚀 Instalación y Configuración

1. **Clonar o descargar el proyecto**
   ```bash
   cd bitacora_adr
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar en modo desarrollo**
   ```bash
   npm run dev
   ```

4. **Ejecutar en producción**
   ```bash
   npm start
   ```

5. **Acceder a la aplicación**
   - Abrir navegador en: `http://localhost:3000`
   - **Crear nueva cuenta** desde la página de login (tab "Crear Cuenta")
   - O usar cuenta demo: `admin` / `admin123`

## 📁 Estructura del Proyecto

```
bitacora_adr/
├── app.js                 # Servidor principal
├── package.json           # Dependencias del proyecto
├── database/
│   └── database.js        # Configuración y métodos de SQLite
├── routes/
│   ├── auth.js           # Rutas de autenticación
│   ├── children.js       # Rutas de gestión de niños
│   ├── dashboard.js      # Ruta del dashboard
│   └── observations.js   # Rutas de observaciones
├── views/
│   ├── layouts/
│   │   └── main.hbs      # Layout principal
│   ├── auth/
│   │   └── login.hbs     # Página de login y registro integrados
│   ├── children/
│   │   ├── index.hbs     # Lista de niños
│   │   ├── add.hbs       # Agregar niño
│   │   ├── detail.hbs    # Detalles del niño
│   │   └── edit.hbs      # Editar niño
│   ├── dashboard/
│   │   └── index.hbs     # Dashboard principal
│   └── observations/
│       ├── index.hbs     # Lista de observaciones
│       └── add.hbs       # Nueva observación
└── public/
    ├── css/
    │   └── styles.css    # Estilos personalizados
    └── js/
        └── main.js       # JavaScript personalizado
```

## 👥 Funcionalidades del Sistema

### 🔐 Sistema de Autenticación
- Página de login moderna con tabs integradas
- Registro de nuevos usuarios disponible para todos
- Sin restricciones de roles - acceso completo para todos los usuarios
- Animaciones y efectos visuales mejorados

### 👨‍🏫 Gestión de Usuarios
- Crear usuarios desde la página de login
- Sistema simplificado sin jerarquías de roles
- Sesiones seguras con expiración automática

### 👶 Gestión de Niños
- Registrar información completa (personal, contacto, médica)
- Editar y actualizar datos
- Historial completo de observaciones por niño
- Vista detallada con resumen de actividades

### 📝 Sistema de Observaciones
- **Tipos de observación**: Participación, Comportamiento, Actitud espiritual, Relación con otros, Necesidades especiales
- **Etiquetas**: Positivo, Para seguimiento, Alerta
- **Preguntas sugeridas**: 17 preguntas organizadas en 3 categorías:
  - Emociones y Familia (6 preguntas)
  - Relaciones en el Salón (6 preguntas)  
  - Amistad y Compañerismo (5 preguntas)
- **Validación**: Formularios validados para evitar envíos incompletos
- **Acciones de seguimiento**: Conversación, Oración, Notificación a padres, Seguimiento futuro
- Utilizar biblioteca de preguntas reflexivas
- Acceso completo a todas las funcionalidades

## 📝 Tipos de Observación

El sistema permite registrar los siguientes tipos de observación:

- ☐ **Participación en la clase**
- ☐ **Comportamiento**
- ☐ **Actitud espiritual** (interés en orar, preguntas sobre Dios)
- ☐ **Relación con otros**
- ☐ **Necesidades especiales** (familiares, emocionales, etc.)
- ☐ **Otros**

## 🏷️ Sistema de Etiquetas

- 🟢 **Positivo**: Observaciones favorables
- 🟡 **Para seguimiento**: Requiere atención continua
- 🔴 **Alerta**: Situaciones que necesitan intervención inmediata

## 💡 Preguntas Sugeridas para Conversaciones Reflexivas

El sistema incluye una biblioteca de preguntas organizadas por categorías para facilitar las conversaciones reflexivas con los niños:

### 🧡 Emociones y Familia
- ¿Qué te gusta hacer con tu familia?
- ¿Qué te pone triste a veces?
- ¿Qué haces cuando alguien que quieres está triste?
- ¿Cómo sabes cuándo estás enojado/a?
- ¿Qué haces para calmarte cuando estás molesto/a?
- ¿Cómo te sientes cuando alguien te felicita?

### 🏫 Relaciones en el Salón
- ¿Cómo te sientes cuando estás en el salón con tus compañeros?
- ¿Hay algo que te gustaría cambiar del salón?
- ¿Te sientes escuchado/a cuando quieres decir algo?
- ¿Qué es lo que más te gusta hacer durante las clases?
- ¿Cómo te sientes cuando la maestra o maestro te ayuda?

### 👫 Amistades y Compañerismo
- ¿Con cuál de tus compañeros te la llevas mejor?
- ¿Qué niño/a te ha hecho sentir mal o te ha excluido?
- ¿Sientes que tienes amigos en el salón?
- ¿Qué haces cuando un compañero no quiere jugar contigo?
- ¿Cómo te hacen sentir tus compañeros cuando cometes un error?
- ¿Te sientes respetado/a por los demás niños?

## 📊 Acciones de Seguimiento

- ✅ ¿Se habló con el niño/a?
- 🙏 ¿Se oró por ese tema?
- 📞 ¿Se notificó a padres o acudientes?
- 📅 ¿Se dará seguimiento en la próxima clase?

## 🗃️ Base de Datos

El sistema utiliza SQLite con las siguientes tablas principales:

- **users**: Maestros y administradores
- **children**: Información de los niños
- **observations**: Registro de observaciones
- **reflective_conversations**: Conversaciones reflexivas (futura implementación)

## 🔒 Seguridad

- Contraseñas encriptadas con bcryptjs
- Sesiones seguras con express-session
- Validación de datos en frontend y backend
- Control de acceso basado en roles

## 📱 Compatibilidad

- ✅ Navegadores modernos (Chrome, Firefox, Safari, Edge)
- ✅ Dispositivos móviles (iOS, Android)
- ✅ Tablets
- ✅ Escritorio

## 🤝 Contribución

Para contribuir al proyecto:

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para más detalles.

## 📞 Soporte

Para soporte o preguntas sobre el sistema:

- Revisar la documentación
- Crear un issue en el repositorio
- Contactar al administrador del sistema

## 🚀 Próximas Características

- [ ] Sistema de conversaciones reflexivas avanzado
- [ ] Reportes en PDF con gráficos
- [ ] Notificaciones automáticas por email
- [ ] Backup automático de base de datos
- [ ] Integración con calendarios externos
- [ ] Modo oscuro para la interfaz
- [ ] Exportación de datos a Excel
- [ ] Sistema de recordatorios personalizados

---

**Desarrollado con ❤️ para el ministerio infantil**

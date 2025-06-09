// Sistema de Backup Automático para Bitácora ADR
// Versión adaptada para PostgreSQL
// Mantiene respaldos en /tmp para recuperación entre deploys

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class BackupManager {
    constructor(db) {
        this.db = db;
        this.backupInterval = 30 * 60 * 1000; // 30 minutos
        this.backupPath = '/tmp/bitacora_backup.json';
        this.isRunning = false;
        this.intervalId = null;
    }

    async startPeriodicBackup() {
        if (this.isRunning) {
            console.log('⚠️ [BACKUP] Sistema ya en ejecución');
            return;
        }
          this.isRunning = true;
        console.log('🔄 [BACKUP] Iniciando sistema de backup automático cada 30 minutos (PostgreSQL)');
        
        try {
            // Backup inicial
            await this.createBackup();
            
            // Backup periódico
            this.intervalId = setInterval(async () => {
                try {
                    await this.createBackup();
                } catch (error) {
                    console.error('❌ [BACKUP] Error en backup automático:', error.message);
                }
            }, this.backupInterval);
            
            console.log('✅ [BACKUP] Sistema iniciado correctamente');
        } catch (error) {
            console.error('❌ [BACKUP] Error iniciando sistema:', error.message);
            this.isRunning = false;
        }
    }

    async createBackup() {
        try {
            console.log('🔄 [BACKUP] Creando backup...');
            
            // Obtener datos de todas las tablas
            const [users, children, observations] = await Promise.all([
                this.safeGetData('getAllUsers'),
                this.safeGetData('getAllChildren'), 
                this.safeGetData('getAllObservations')
            ]);

            const backupData = {
                users: users || [],
                children: children || [],
                observations: observations || [],                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.1-pg',
                    totalRecords: (users?.length || 0) + (children?.length || 0) + (observations?.length || 0)
                }
            };

            // Guardar backup en archivo
            await this.writeBackupFile(backupData);
            
            console.log(`✅ [BACKUP] Backup creado (PostgreSQL): ${backupData.users.length} usuarios, ${backupData.children.length} niños, ${backupData.observations.length} observaciones`);
            return backupData;
        } catch (error) {
            console.error('❌ [BACKUP] Error creando backup:', error.message);
            throw error;
        }
    }

    async safeGetData(methodName) {
        try {
            if (!this.db || typeof this.db[methodName] !== 'function') {
                console.warn(`⚠️ [BACKUP] Método ${methodName} no disponible`);
                return [];
            }
            
            return await this.db[methodName]();
        } catch (error) {
            console.warn(`⚠️ [BACKUP] Error obteniendo ${methodName}:`, error.message);
            return [];
        }
    }

    async writeBackupFile(data) {
        try {
            const backupContent = JSON.stringify(data, null, 2);
            
            // Escribir archivo de forma atómica (temp + rename)
            const tempPath = `${this.backupPath}.tmp`;
            fs.writeFileSync(tempPath, backupContent, 'utf8');
            fs.renameSync(tempPath, this.backupPath);
            
            // También crear backup con timestamp para histórico
            const timestampPath = `/tmp/bitacora_backup_${Date.now()}.json`;
            fs.writeFileSync(timestampPath, backupContent, 'utf8');
            
            // Limpiar backups antiguos (mantener solo los últimos 5)
            this.cleanOldBackups();
            
        } catch (error) {
            console.error('❌ [BACKUP] Error escribiendo archivo:', error.message);
            throw error;
        }
    }

    cleanOldBackups() {
        try {
            const backupFiles = fs.readdirSync('/tmp')
                .filter(file => file.startsWith('bitacora_backup_') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join('/tmp', file),
                    mtime: fs.statSync(path.join('/tmp', file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Eliminar archivos antiguos (mantener solo los últimos 5)
            if (backupFiles.length > 5) {
                const filesToDelete = backupFiles.slice(5);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        console.log(`🗑️ [BACKUP] Eliminado backup antiguo: ${file.name}`);
                    } catch (deleteError) {
                        console.warn(`⚠️ [BACKUP] Error eliminando ${file.name}:`, deleteError.message);
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ [BACKUP] Error limpiando backups antiguos:', error.message);
        }
    }

    async restoreFromBackup() {
        try {
            if (!fs.existsSync(this.backupPath)) {
                console.log('ℹ️ [BACKUP] No se encontró archivo de backup para restaurar');
                return false;
            }

            const backupContent = fs.readFileSync(this.backupPath, 'utf8');
            const backupData = JSON.parse(backupContent);
            
            console.log('📊 [BACKUP] Backup disponible encontrado:', {
                timestamp: backupData.metadata?.timestamp,
                users: backupData.users?.length || 0,
                children: backupData.children?.length || 0,
                observations: backupData.observations?.length || 0,
                totalRecords: backupData.metadata?.totalRecords || 0
            });
            
            // Por ahora solo informativo, en el futuro se puede implementar restauración automática
            return backupData;
            
        } catch (error) {
            console.error('❌ [BACKUP] Error leyendo backup:', error.message);
            return false;
        }
    }

    getBackupInfo() {
        try {
            if (!fs.existsSync(this.backupPath)) {
                return { exists: false };
            }

            const stats = fs.statSync(this.backupPath);
            const content = fs.readFileSync(this.backupPath, 'utf8');
            const data = JSON.parse(content);

            return {
                exists: true,
                size: stats.size,
                lastModified: stats.mtime.toISOString(),
                recordCount: {
                    users: data.users?.length || 0,
                    children: data.children?.length || 0,
                    observations: data.observations?.length || 0,
                    total: data.metadata?.totalRecords || 0
                },
                metadata: data.metadata
            };
        } catch (error) {
            console.error('❌ [BACKUP] Error obteniendo info:', error.message);
            return { exists: false, error: error.message };
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 [BACKUP] Sistema detenido');
    }
}

module.exports = BackupManager;

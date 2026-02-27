
/**
 * Markazlashgan Xatolarni Log qilish tizimi.
 * Barcha xatolar shu yer orqali o'tadi va konsolga formatlangan holda chiqadi.
 */

type LogLevel = 'info' | 'warn' | 'error';

class Logger {
  private formatMessage(level: LogLevel, context: string, message: any) {
    const timestamp = new Date().toLocaleTimeString();
    const icon = level === 'error' ? '🚨' : level === 'warn' ? '⚠️' : 'ℹ️';
    return [`%c${icon} [${timestamp}] [${context}]:`, 'font-weight: bold;', message];
  }

  info(context: string, message: any, data?: any) {
    console.log(...this.formatMessage('info', context, message));
    if (data) console.log(data);
  }

  warn(context: string, message: any, data?: any) {
    console.warn(...this.formatMessage('warn', context, message));
    if (data) console.warn(data);
  }

  error(context: string, error: any, errorInfo?: any) {
    console.group(`%c🚨 ERROR in ${context}`, 'color: red; font-weight: bold; font-size: 12px;');
    
    console.error('Message:', error instanceof Error ? error.message : error);
    console.error('Stack Trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (errorInfo) {
      console.error('Additional Info:', errorInfo);
    }

    console.groupEnd();
  }
}

export const logger = new Logger();

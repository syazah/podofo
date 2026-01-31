import { createLogger, format, transports, Logger as WinstonLogger } from "winston";

export class AppLogger {
    private static infoLogger: WinstonLogger;
    private static errorLogger: WinstonLogger;

    private constructor() { }

    public static getInfoLogger(): WinstonLogger {
        if (!AppLogger.infoLogger) {
            AppLogger.infoLogger = createLogger({
                level: "info",
                format: format.combine(
                    format.timestamp(),
                    format.json()
                ),
                transports: [
                    new transports.Console(),
                ],
            });
        }
        return AppLogger.infoLogger;
    }

    public static getErrorLogger(): WinstonLogger {
        if (!AppLogger.errorLogger) {
            AppLogger.errorLogger = createLogger({
                level: "error",
                format: format.combine(
                    format.timestamp(),
                    format.errors({ stack: true }),
                    format.json()
                ),
                transports: [
                    new transports.Console(),
                    new transports.File({ filename: "logs/error.log" }),
                ],
            });
        }
        return AppLogger.errorLogger;
    }
}

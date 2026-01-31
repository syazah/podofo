import type { HttpStatus } from "http-status";
import httpStatus from "http-status"
export class HttpError extends Error {
    status: number;

    constructor(message: string, status?: number) {
        super(message);
        this.status = status || httpStatus.INTERNAL_SERVER_ERROR;
    }
}
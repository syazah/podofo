import multer from 'multer'

const fileFilter = (_req: any, file: any, cb: any) => {
    const allowedFileTypes = ["application/pdf"]
    if (!allowedFileTypes.includes(file.mimetype)) {
        return cb(new Error("Invalid File Type Provided"))
    }
    return cb(null, true)
}

export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 1 * 1024 * 1024, // 1MB per file
    }
})

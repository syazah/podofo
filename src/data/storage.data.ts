import { projectConstants } from "../config/constants.js";
import { supabaseAdmin } from "../config/supabase/client.js";

export class S3Storage {
    private static instance: S3Storage;

    private constructor() { }

    public static getInstance(): S3Storage {
        if (!S3Storage.instance) {
            S3Storage.instance = new S3Storage()
        }
        return S3Storage.instance;
    }

    public async downloadImage(storagePath: string): Promise<Buffer> {
        const { data, error } = await supabaseAdmin.storage
            .from("pdfs")
            .download(storagePath);

        if (error || !data) {
            throw new Error(`Failed to download image at ${storagePath}: ${error?.message ?? "no data"}`);
        }

        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    public uploadToStorage = async (
        filePath: string,
        buffer: Uint8Array,
        contentType: string
    ): Promise<string> => {
        const { error } = await supabaseAdmin.storage
            .from(projectConstants.BUCKET)
            .upload(filePath, buffer, {
                contentType,
                upsert: false,
            });

        if (error) throw new Error(`Storage upload failed: ${error.message}`);
        return filePath;
    };
}
import { Router } from 'express';
import { analyzeController } from '../controllers/analyze.controller';
import multer from 'multer';

const router = Router();

// Configure Multer for memory storage (buffer access)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// POST /api/analyze
router.post('/analyze', upload.single('file'), analyzeController.analyze.bind(analyzeController));

export default router;

import { Router } from 'express';
import parseRouter from './parse';

const router = Router();

router.use(parseRouter);

// 健康检查接口（用于运维/冒烟测试探活）
router.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'vidpop',
    env: process.env.COZE_PROJECT_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;
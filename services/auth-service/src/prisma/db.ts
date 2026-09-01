import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import { readFileSync } from 'fs';
import { join } from 'path';

// Загружаем contract.json через fs (обход import attributes)
const contractJson = JSON.parse(
  readFileSync(join(__dirname, 'contract.json'), 'utf-8'),
);

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});

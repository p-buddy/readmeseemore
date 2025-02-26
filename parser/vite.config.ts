import { defineConfig } from 'vitest/config';
import { baseConfig } from '../globals';

export default defineConfig(
    baseConfig(__dirname, 'index')
);
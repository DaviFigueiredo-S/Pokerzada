import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',workers:1,timeout:45000,globalTimeout:240000,use:{baseURL:'http://127.0.0.1:4174',launchOptions:{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-fake-device-for-media-stream']},screenshot:'only-on-failure',trace:'retain-on-failure'}});

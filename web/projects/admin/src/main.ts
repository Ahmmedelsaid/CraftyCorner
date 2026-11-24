import { bootstrapApplication } from '@angular/platform-browser';
import { AdminApp } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(AdminApp, appConfig).catch((err) => console.error(err));

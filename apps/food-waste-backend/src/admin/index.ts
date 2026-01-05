// Main module export
export { AdminModule } from './admin.module';

// Service exports (for potential use by other modules)
export * from './services';

// DTO exports (for API documentation and validation)
export * from './dto';

// Interface exports (for type definitions)
export * from './interfaces/admin-analytics.interface';

// Guard exports (might be useful elsewhere)
export { AdminOnlyGuard } from './guards/admin-only.guard';

// Decorator exports (might be useful in other modules)
export * from './decorators';
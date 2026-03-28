import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type DashboardConfigDocument = DashboardConfig & Document;

export interface WidgetVisualization {
  chartType?:
    | 'line'
    | 'bar'
    | 'pie'
    | 'donut'
    | 'area'
    | 'scatter'
    | 'stacked_bar'
    | 'radial_bar'
    | 'heatmap'
    | undefined;
  xAxis?: string | undefined;
  yAxis?: string | string[] | undefined;
  colorScheme?: string[] | undefined;
  colorBy?: string | undefined;
  field?: string | undefined;
  value?: string | undefined;
  metrics?: string[] | undefined;
  columns?: string[] | undefined;
  sorting?:
    | {
        column: string;
        direction: 'asc' | 'desc';
      }
    | undefined;
  mapType?: 'heat' | 'marker' | 'cluster' | undefined;
  centerLat?: number | undefined;
  centerLng?: number | undefined;
  zoom?: number | undefined;
  displayOptions?: Record<string, string | number | boolean> | undefined;
}

export interface WidgetPosition {
  row: number;
  column: number;
  width: number;
  height: number;
}

export interface Widget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'heatmap';
  title: string;
  description?: string;
  dataSource: string;
  visualization: WidgetVisualization;
  filters: Record<string, string | number | boolean | string[] | number[]>;
  refreshInterval?: number;
  position: WidgetPosition;
}

export interface DashboardPermissions {
  viewRoles: string[];
  editRoles: string[];
}

@Schema({
  timestamps: true,
  collection: 'dashboard_configs',
})
export class DashboardConfig {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  })
  name!: string;

  @Prop({
    type: String,
    maxlength: 500,
  })
  description?: string;

  @Prop({
    type: String,
    enum: ['business', 'operations', 'sustainability', 'customer', 'financial'],
    required: true,
    index: true,
  })
  category!: 'business' | 'operations' | 'sustainability' | 'customer' | 'financial';

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        type: {
          type: String,
          enum: ['metric', 'chart', 'table', 'map', 'heatmap'],
          required: true,
        },
        title: { type: String, required: true },
        description: String,
        dataSource: { type: String, required: true },
        visualization: {
          chartType: {
            type: String,
            enum: [
              'line',
              'bar',
              'pie',
              'donut',
              'area',
              'scatter',
              'stacked_bar',
              'radial_bar',
              'heatmap',
            ],
          },
          xAxis: String,
          yAxis: { type: MongooseSchema.Types.Mixed }, // Can be string or string[]
          colorScheme: [String],
          colorBy: String,
          field: String,
          value: String,
          metrics: [String],
          columns: [String],
          sorting: {
            column: String,
            direction: { type: String, enum: ['asc', 'desc'] },
          },
          mapType: {
            type: String,
            enum: ['heat', 'marker', 'cluster'],
          },
          centerLat: Number,
          centerLng: Number,
          zoom: { type: Number, min: 1, max: 20 },
          displayOptions: Object,
        },
        filters: { type: Object, required: true },
        refreshInterval: { type: Number, min: 1, max: 1440 },
        position: {
          row: { type: Number, required: true, min: 1 },
          column: { type: Number, required: true, min: 1 },
          width: { type: Number, required: true, min: 1, max: 12 },
          height: { type: Number, required: true, min: 1, max: 6 },
        },
      },
    ],
    required: true,
    validate: {
      validator(widgets: Widget[]) {
        return widgets.length > 0 && widgets.length <= 20;
      },
      message: 'Dashboard must have between 1 and 20 widgets',
    },
  })
  widgets!: Widget[];

  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isDefault!: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    index: true,
  })
  userId?: Types.ObjectId; // for personal dashboards

  @Prop({
    type: {
      viewRoles: {
        type: [String],
        required: true,
        validate: {
          validator(roles: string[]) {
            const validRoles = ['admin', 'merchant', 'consumer'];
            return roles.every((role) => validRoles.includes(role));
          },
          message: 'Invalid role in viewRoles',
        },
      },
      editRoles: {
        type: [String],
        required: true,
        validate: {
          validator(roles: string[]) {
            const validRoles = ['admin', 'merchant', 'consumer'];
            return roles.every((role) => validRoles.includes(role));
          },
          message: 'Invalid role in editRoles',
        },
      },
    },
  })
  permissions?: DashboardPermissions;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: Number,
    default: 1,
    min: 1,
  })
  version!: number;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  tags!: string[];

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  viewCount!: number;

  @Prop({
    type: Date,
  })
  lastViewedAt?: Date;
  // createdAt and updatedAt are managed by Mongoose `timestamps: true`
  createdAt?: Date;
  updatedAt?: Date;
}

export const DashboardConfigSchema = SchemaFactory.createForClass(DashboardConfig);

// Indexes
DashboardConfigSchema.index({ name: 1, userId: 1 }, { unique: true });
DashboardConfigSchema.index({ category: 1, isActive: 1 });
DashboardConfigSchema.index({ 'permissions.viewRoles': 1 });
DashboardConfigSchema.index({ createdBy: 1 });
DashboardConfigSchema.index({ tags: 1 });

// Middleware
DashboardConfigSchema.pre('save', function () {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
    const _updatedBy = (this as DashboardConfig & { _updatedBy?: Types.ObjectId })._updatedBy;
    if (_updatedBy !== undefined) {
      this.updatedBy = _updatedBy;
    }
  }
});

// Removed redundant findOneAndUpdate pre-hook — Mongoose `timestamps: true` handles updatedAt automatically

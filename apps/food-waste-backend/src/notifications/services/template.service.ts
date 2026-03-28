import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';

import { NotificationTemplate } from '../schemas/notification-template.schema';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectModel(NotificationTemplate.name)
    private readonly templateModel: Model<NotificationTemplate>,
  ) {}

  render(
    template: NotificationTemplate,
    variables: Record<string, unknown>,
    language: string = 'en',
  ): { subject: string; body: string; htmlBody?: string | undefined } {
    try {
      // Get localized content or fall back to default
      const content = this.getLocalizedContent(template, language);

      return {
        subject: this.interpolateVariables(content.subject, variables),
        body: this.interpolateVariables(content.body, variables),
        htmlBody: content.htmlBody
          ? this.interpolateVariables(content.htmlBody, variables)
          : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Template rendering failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async createTemplate(templateData: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const template = new this.templateModel(templateData);
    const saved = await template.save();
    return saved;
  }

  async updateTemplate(
    templateId: string,
    updateData: Partial<NotificationTemplate>,
  ): Promise<NotificationTemplate | null> {
    const updated = await this.templateModel
      .findByIdAndUpdate(templateId, updateData, { new: true })
      .exec();
    return updated;
  }

  async getTemplate(name: string): Promise<NotificationTemplate | null> {
    const template = await this.templateModel.findOne({ name, isActive: true });
    return template;
  }

  async getTemplatesByTrigger(trigger: string): Promise<NotificationTemplate[]> {
    const templates = await this.templateModel.find({ trigger, isActive: true });
    return templates;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.templateModel.findByIdAndUpdate(templateId, { isActive: false });
  }

  async cloneTemplate(
    templateId: string,
    newName: string,
    modifications?: Partial<NotificationTemplate>,
  ): Promise<NotificationTemplate> {
    const originalTemplate = await this.templateModel.findById(templateId);

    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    const clonedData = {
      ...originalTemplate.toObject(),
      _id: undefined,
      name: newName,
      version: '1.0',
      createdAt: undefined,
      updatedAt: undefined,
      ...modifications,
    };

    const cloned = new this.templateModel(clonedData);
    return cloned.save();
  }

  validateTemplate(template: Partial<NotificationTemplate>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!template.name) {
      errors.push('Template name is required');
    }
    if (!template.subject) {
      errors.push('Template subject is required');
    }
    if (!template.body) {
      errors.push('Template body is required');
    }
    if (!template.trigger) {
      errors.push('Template trigger is required');
    }
    if (!template.type) {
      errors.push('Template type is required');
    }

    // Check for undefined variables in template
    const variables = this.extractVariables(template.subject || '');
    variables.push(...this.extractVariables(template.body || ''));
    if (template.htmlBody) {
      variables.push(...this.extractVariables(template.htmlBody));
    }

    // Validate variable syntax
    const invalidVariables = variables.filter((variable) => !this.isValidVariableSyntax(variable));

    if (invalidVariables.length > 0) {
      errors.push(`Invalid variable syntax: ${invalidVariables.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async previewTemplate(
    templateId: string,
    sampleVariables: Record<string, unknown>,
    language: string = 'en',
  ): Promise<{ subject: string; body: string; htmlBody?: string | undefined }> {
    const template = await this.templateModel.findById(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    return this.render(template, sampleVariables, language);
  }

  async getTemplateVariables(templateId: string): Promise<string[]> {
    const template = await this.templateModel.findById(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    const variables = new Set<string>();

    this.extractVariables(template.subject).forEach((v) => variables.add(v));
    this.extractVariables(template.body).forEach((v) => variables.add(v));

    if (template.htmlBody) {
      this.extractVariables(template.htmlBody).forEach((v) => variables.add(v));
    }

    return Array.from(variables);
  }

  async bulkUpdateTemplates(
    filter: FilterQuery<NotificationTemplate>,
    updateData: Partial<NotificationTemplate>,
  ): Promise<{ modifiedCount: number }> {
    const result = await this.templateModel.updateMany(filter, updateData);
    return { modifiedCount: result.modifiedCount };
  }

  private getLocalizedContent(
    template: NotificationTemplate,
    language: string,
  ): { subject: string; body: string; htmlBody?: string | undefined } {
    const localized = template.localization?.get(language);

    if (localized) {
      return {
        subject: localized.subject,
        body: localized.body,
        htmlBody: localized.htmlBody,
      };
    }

    // Fall back to default content
    return {
      subject: template.subject,
      body: template.body,
      htmlBody: template.htmlBody,
    };
  }

  private interpolateVariables(text: string, variables: Record<string, unknown>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = variables[variableName];

      if (value === null || value === undefined) {
        this.logger.warn(`Variable '${variableName}' not found in template data`);
        return match; // Keep original placeholder if variable not found
      }

      return String(value);
    });
  }

  private extractVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map((match) => match.replace(/\{\{|\}\}/g, ''));
  }

  private isValidVariableSyntax(variable: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable);
  }

  // Helper method to create default templates
  async seedDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      {
        name: 'order_confirmation_email',
        trigger: 'order_confirmed',
        type: 'email',
        subject: 'Order Confirmed - {{establishmentName}}',
        body: 'Hi {{userName}}, your order for "{{offerTitle}}" has been confirmed. Pickup at {{establishmentName}} during {{pickupTime}}.',
        htmlBody: `
          <h2>Order Confirmed!</h2>
          <p>Hi {{userName}},</p>
          <p>Your order for "<strong>{{offerTitle}}</strong>" has been confirmed.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Pickup Details:</h3>
            <p><strong>Location:</strong> {{establishmentName}}</p>
            <p><strong>Address:</strong> {{establishmentAddress}}</p>
            <p><strong>Time:</strong> {{pickupTime}}</p>
            <p><strong>Order ID:</strong> {{orderId}}</p>
          </div>
          <p>Please arrive during the specified pickup window and present your QR code.</p>
        `,
        isActive: true,
        version: '1.0',
      },
      {
        name: 'pickup_reminder_push',
        trigger: 'pickup_reminder_2h',
        type: 'push',
        subject: 'Pickup Reminder',
        body: 'Your order from {{establishmentName}} is ready! Pickup in the next {{timeRemaining}}.',
        isActive: true,
        version: '1.0',
      },
      {
        name: 'new_offer_nearby_push',
        trigger: 'new_offer_nearby',
        type: 'push',
        subject: 'New Offer Near You!',
        body: '{{establishmentName}} has a new surprise box for {{originalPrice}} ({{discountPercentage}}% off)!',
        isActive: true,
        version: '1.0',
      },
      {
        name: 'urgent_pickup_sms',
        trigger: 'pickup_reminder_2h',
        type: 'sms',
        subject: 'Urgent Pickup Reminder',
        body: 'URGENT: Your order at {{establishmentName}} expires in {{timeRemaining}}. Order: {{orderId}}',
        isActive: true,
        version: '1.0',
      },
    ];

    for (const templateData of defaultTemplates) {
      const existing = await this.templateModel.findOne({ name: templateData.name });

      if (!existing) {
        await this.templateModel.create(templateData);
        this.logger.log(`Created default template: ${templateData.name}`);
      }
    }
  }
}

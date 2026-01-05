#!/usr/bin/env node

/**
 * Accessibility Validation Script for Coverage Reports
 * Validates that accessibility enhancements are properly implemented
 */

const fs = require('fs');
const path = require('path');

class AccessibilityValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
    }

    validateFile(filePath) {
        console.log(`\n🔍 Validating: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            this.errors.push(`File not found: ${filePath}`);
            return false;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Check required accessibility elements
        this.checkSkipLinks(content);
        this.checkLiveRegion(content);
        this.checkSemanticLandmarks(content);
        this.checkHeadingHierarchy(content);
        this.checkAriaLabels(content);
        this.checkKeyboardNavigation(content);
        this.checkTableAccessibility(content);
        this.checkBreadcrumbNavigation(content);
        this.checkSearchAccessibility(content);
        this.checkFocusManagement(content);

        return this.errors.length === 0;
    }

    checkSkipLinks(content) {
        if (content.includes('skip-link') && content.includes('Skip to main content')) {
            this.successes.push('✅ Skip navigation links implemented');
        } else {
            this.errors.push('❌ Missing skip navigation links');
        }
    }

    checkLiveRegion(content) {
        if (content.includes('aria-live="polite"') && content.includes('accessibility-announcements')) {
            this.successes.push('✅ ARIA live region for announcements');
        } else {
            this.errors.push('❌ Missing ARIA live region');
        }
    }

    checkSemanticLandmarks(content) {
        const landmarks = ['role="main"', 'role="banner"', '<nav', '<section', '<header'];
        const foundLandmarks = landmarks.filter(landmark => content.includes(landmark));

        if (foundLandmarks.length >= 4) {
            this.successes.push('✅ Semantic landmarks implemented');
        } else {
            this.warnings.push(`⚠️  Only ${foundLandmarks.length}/5 semantic landmarks found`);
        }
    }

    checkHeadingHierarchy(content) {
        const h1Count = (content.match(/<h1/g) || []).length;
        const h2Count = (content.match(/<h2/g) || []).length;

        if (h1Count === 1 && h2Count >= 2) {
            this.successes.push('✅ Proper heading hierarchy (H1→H2→H3)');
        } else {
            this.errors.push('❌ Improper heading hierarchy');
        }
    }

    checkAriaLabels(content) {
        const ariaAttributes = [
            'aria-label=',
            'aria-labelledby=',
            'aria-describedby=',
            'aria-live=',
            'role='
        ];

        const foundAttributes = ariaAttributes.filter(attr => content.includes(attr));

        if (foundAttributes.length >= 4) {
            this.successes.push('✅ Comprehensive ARIA attributes');
        } else {
            this.warnings.push('⚠️  Limited ARIA attribute usage');
        }
    }

    checkKeyboardNavigation(content) {
        if (content.includes('tabindex="0"') && content.includes('keydown')) {
            this.successes.push('✅ Keyboard navigation support');
        } else {
            this.errors.push('❌ Missing keyboard navigation');
        }
    }

    checkTableAccessibility(content) {
        const tableFeatures = [
            '<caption',
            'scope="col"',
            'role="rowheader"',
            'aria-describedby='
        ];

        const foundFeatures = tableFeatures.filter(feature => content.includes(feature));

        if (foundFeatures.length >= 3) {
            this.successes.push('✅ Accessible table structure');
        } else {
            this.errors.push('❌ Table accessibility issues');
        }
    }

    checkBreadcrumbNavigation(content) {
        if (content.includes('Breadcrumb navigation') && content.includes('aria-current="page"')) {
            this.successes.push('✅ Accessible breadcrumb navigation');
        } else {
            this.warnings.push('⚠️  Basic or missing breadcrumb navigation');
        }
    }

    checkSearchAccessibility(content) {
        if (content.includes('role="searchbox"') || content.includes('type="search"')) {
            this.successes.push('✅ Accessible search functionality');
        } else {
            this.warnings.push('⚠️  Search accessibility could be improved');
        }
    }

    checkFocusManagement(content) {
        if (content.includes('focus()') && content.includes(':focus')) {
            this.successes.push('✅ Focus management implemented');
        } else {
            this.warnings.push('⚠️  Limited focus management');
        }
    }

    validateCSSFile(filePath) {
        console.log(`\n🎨 Validating CSS: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            this.errors.push(`CSS file not found: ${filePath}`);
            return false;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Check essential CSS classes
        const requiredClasses = [
            '.sr-only',
            '.skip-link',
            '.coverage-stat:focus',
            '.line-number-link:focus',
            '@media (prefers-contrast: high)',
            '@media (prefers-reduced-motion: reduce)'
        ];

        const foundClasses = requiredClasses.filter(cls => content.includes(cls));

        if (foundClasses.length >= 5) {
            this.successes.push('✅ Comprehensive accessibility CSS');
        } else {
            this.errors.push(`❌ Missing accessibility CSS classes: ${requiredClasses.length - foundClasses.length} missing`);
        }

        return true;
    }

    validateJSFile(filePath) {
        console.log(`\n📜 Validating JavaScript: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            this.errors.push(`JavaScript file not found: ${filePath}`);
            return false;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Check essential JavaScript features
        const requiredFeatures = [
            'AccessibilityManager',
            'setupKeyboardNavigation',
            'announce',
            'setupSearchAccessibility',
            'aria-live'
        ];

        const foundFeatures = requiredFeatures.filter(feature => content.includes(feature));

        if (foundFeatures.length >= 4) {
            this.successes.push('✅ Comprehensive accessibility JavaScript');
        } else {
            this.errors.push(`❌ Missing accessibility JavaScript features: ${requiredFeatures.length - foundFeatures.length} missing`);
        }

        return true;
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 ACCESSIBILITY VALIDATION REPORT');
        console.log('='.repeat(80));

        if (this.successes.length > 0) {
            console.log('\n✅ SUCCESSES:');
            this.successes.forEach(success => console.log(`  ${success}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(warning => console.log(`  ${warning}`));
        }

        if (this.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.errors.forEach(error => console.log(`  ${error}`));
        }

        console.log('\n' + '='.repeat(80));
        console.log(`📈 SUMMARY: ${this.successes.length} successes, ${this.warnings.length} warnings, ${this.errors.length} errors`);

        if (this.errors.length === 0) {
            console.log('🎉 All accessibility validations passed!');
            return true;
        } else {
            console.log('🚨 Accessibility issues found. Please review and fix.');
            return false;
        }
    }
}

// Main validation execution
function main() {
    console.log('🚀 Starting Accessibility Validation...\n');

    const validator = new AccessibilityValidator();
    const basePath = path.join(__dirname, '..');

    // Files to validate
    const filesToValidate = [
        'coverage/lcov-report/src/admin/services/admin-analytics.service.ts.html',
        'coverage/lcov-report/accessibility.css',
        'coverage/lcov-report/accessibility.js'
    ];

    let allValid = true;

    // Validate each file
    filesToValidate.forEach(file => {
        const fullPath = path.join(basePath, file);

        if (file.endsWith('.html')) {
            allValid = validator.validateFile(fullPath) && allValid;
        } else if (file.endsWith('.css')) {
            allValid = validator.validateCSSFile(fullPath) && allValid;
        } else if (file.endsWith('.js')) {
            allValid = validator.validateJSFile(fullPath) && allValid;
        }
    });

    // Generate final report
    const success = validator.generateReport();

    // Exit with appropriate code
    process.exit(success ? 0 : 1);
}

// Run validation if called directly
if (require.main === module) {
    main();
}

module.exports = { AccessibilityValidator };
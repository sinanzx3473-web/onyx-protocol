# Accessibility Audit & Guidelines

## Overview
ONYX is built with accessibility as a core principle, ensuring all users can trade, provide liquidity, and manage their assets regardless of their abilities or assistive technologies used.

## WCAG 2.1 Level AA Compliance

### Perceivable
- **Text Alternatives**: All non-text content has text alternatives (alt text, aria-labels)
- **Color Contrast**: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text
- **Adaptable Content**: Content can be presented in different ways without losing information
- **Distinguishable**: Easy to see and hear content, including separation of foreground from background

### Operable
- **Keyboard Accessible**: All functionality available via keyboard
- **Enough Time**: Users have adequate time to read and use content
- **Seizures and Physical Reactions**: No content flashes more than three times per second
- **Navigable**: Clear navigation mechanisms and skip links

### Understandable
- **Readable**: Text content is readable and understandable
- **Predictable**: Web pages appear and operate in predictable ways
- **Input Assistance**: Users are helped to avoid and correct mistakes

### Robust
- **Compatible**: Content is compatible with current and future user tools
- **Valid HTML**: Proper semantic HTML structure
- **ARIA**: Appropriate ARIA attributes for dynamic content

## Keyboard Navigation

### Global Navigation
- **Tab**: Move forward through interactive elements
- **Shift + Tab**: Move backward through interactive elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dialogs
- **Arrow Keys**: Navigate within tab groups and select menus

### Page-Specific Shortcuts
- **Swap Page**: Tab through form inputs, use Enter to confirm
- **Liquidity Page**: Navigate between Add/Remove tabs with arrow keys
- **Pools Page**: Use arrow keys to expand/collapse pool details
- **My Account**: Navigate between Transactions/Positions tabs

### Focus Management
- Focus indicators are clearly visible (2px purple ring)
- Focus is trapped within modal dialogs
- Focus returns to trigger element when modals close
- Skip links available for keyboard users

## Screen Reader Support

### Tested With
- **NVDA** (Windows)
- **JAWS** (Windows)
- **VoiceOver** (macOS/iOS)
- **TalkBack** (Android)

### Best Practices Implemented
- Semantic HTML elements (`<nav>`, `<main>`, `<article>`, etc.)
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA landmarks for page regions
- ARIA live regions for dynamic content updates
- Descriptive link text and button labels
- Form labels properly associated with inputs
- Error messages announced to screen readers

### Dynamic Content
- Transaction status changes announced via `aria-live="polite"`
- Network errors announced via `aria-live="assertive"`
- Loading states indicated with `aria-busy="true"`
- Modal dialogs use `role="dialog"` and `aria-modal="true"`

## Touch Targets

### Mobile Optimization
- **Minimum Size**: All interactive elements are at least 44×44px
- **Spacing**: Adequate spacing between touch targets (minimum 8px)
- **Responsive Design**: Layouts adapt to screen sizes down to 320px width
- **Gesture Support**: No functionality requires complex gestures

### Button Sizes
- Default buttons: 44px height
- Small buttons: 44px height (increased from 32px)
- Large buttons: 48px height
- Icon buttons: 44×44px minimum

## Color and Contrast

### Color Contrast Ratios
- **Normal Text**: 4.5:1 minimum (WCAG AA)
- **Large Text**: 3:1 minimum (WCAG AA)
- **UI Components**: 3:1 minimum for borders and icons
- **Focus Indicators**: 3:1 minimum against background

### Color Independence
- Information is not conveyed by color alone
- Status indicators use icons + color + text
- Error states use icons, color, and descriptive text
- Success states clearly indicated with multiple cues

### Dark Mode
- System preference detection
- Manual toggle available
- Maintains contrast ratios in both modes
- Smooth transitions between modes

## Forms and Input

### Form Accessibility
- All inputs have associated labels
- Required fields clearly marked
- Error messages descriptive and helpful
- Validation feedback immediate and clear
- Autocomplete attributes where appropriate

### Error Handling
- Errors explained in plain English
- Suggestions provided for correction
- Error summaries at top of forms
- Inline validation with clear messaging

### Input Types
- Appropriate input types for mobile keyboards
- Number inputs for amounts
- Text inputs for addresses
- Pattern validation where needed

## Testing Procedures

### Automated Testing
```bash
# Run accessibility tests
pnpm test:e2e e2e/accessibility.spec.ts

# Check for WCAG violations
pnpm lighthouse --accessibility
```

### Manual Testing Checklist
- [ ] Navigate entire app using keyboard only
- [ ] Test with screen reader (NVDA/VoiceOver)
- [ ] Verify color contrast with tools
- [ ] Test on mobile devices (touch targets)
- [ ] Verify focus indicators visible
- [ ] Test form validation and errors
- [ ] Verify modal focus trapping
- [ ] Test with browser zoom (200%)
- [ ] Verify text spacing adjustments
- [ ] Test with high contrast mode

### Browser Testing
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Known Issues and Roadmap

### Current Limitations
- Some third-party wallet modals may not be fully accessible
- Chart visualizations may need additional ARIA descriptions
- Complex table sorting could be improved for screen readers

### Future Improvements
- [ ] Add keyboard shortcuts documentation page
- [ ] Implement skip navigation links
- [ ] Add ARIA descriptions for charts
- [ ] Improve table sorting announcements
- [ ] Add high contrast theme option
- [ ] Implement reduced motion preferences

## Resources

### Tools Used
- **axe DevTools**: Automated accessibility testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Performance and accessibility audits
- **Color Contrast Analyzer**: WCAG contrast checking
- **Playwright**: E2E accessibility testing

### Standards and Guidelines
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Support

If you encounter accessibility barriers while using ONYX, please:
1. Report issues via GitHub Issues with "accessibility" label
2. Contact support at accessibility@codenut.dev
3. Include details about your assistive technology and browser

We are committed to making ONYX accessible to everyone and welcome feedback on how we can improve.

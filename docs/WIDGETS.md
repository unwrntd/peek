# Widget Configuration Guide

This guide explains how to configure widgets, their visualizations, filters, and appearance settings.

## Overview

Widgets are the building blocks of your dashboard. Each widget connects to an integration and displays data in various formats. This guide covers:

1. Widget settings and configuration
2. Visualization options
3. Filter configurations
4. Size and layout options
5. Creating custom widgets

## Widget Settings

Every widget has configurable settings accessible through the widget settings modal (click the gear icon on any widget).

### General Tab

- **Title**: Custom display name for the widget
- **Refresh Interval**: How often the widget refreshes data (in seconds)

### Appearance Tab

Configure how data is displayed:

- **Visualization**: Choose from available visualization styles
- **Hide Labels**: Toggle to show/hide descriptive labels
- **Metric Size**: Enable compact single-metric display

### Filters Tab

Filter and customize the data shown:

- **Select filters**: Choose from predefined options
- **Text filters**: Enter search terms or patterns
- **Checkbox filters**: Toggle specific features
- **Checkbox groups**: Enable/disable multiple items

## Visualization Options

Different widget types support different visualizations. Common options include:

### Metric Visualizations

| Type | Description | Best For |
|------|-------------|----------|
| `numbers` | Large numeric display | Key metrics, counts |
| `metrics` | Grid of labeled values | Multiple statistics |
| `compact` | Dense key-value list | Limited space |

### Chart Visualizations

| Type | Description | Best For |
|------|-------------|----------|
| `donut` | Circular donut chart | Proportions, percentages |
| `bars` | Horizontal bar chart | Comparisons |
| `gauge` | Circular gauge | Usage percentages |
| `progress` | Progress bars | Status tracking |

### List Visualizations

| Type | Description | Best For |
|------|-------------|----------|
| `list` | Detailed item list | Full information |
| `cards` | Card grid layout | Visual overview |
| `compact` | Dense list view | Many items |
| `timeline` | Chronological list | Events, history |

### Specialized Visualizations

| Type | Description | Best For |
|------|-------------|----------|
| `cloud` | Tag cloud | Tag/category display |
| `carousel` | Image carousel | Photo galleries |
| `tree` | Tree structure | Hierarchical data |

## Filter Types

Widgets can have various filter configurations:

### Select Filter

Dropdown with predefined options:

```typescript
{
  label: 'Status',
  key: 'status',
  type: 'select',
  options: [
    { value: '', label: 'All' },
    { value: 'running', label: 'Running' },
    { value: 'stopped', label: 'Stopped' },
  ],
}
```

### Text Filter

Free-form text input with pattern support:

```typescript
{
  label: 'Search',
  key: 'search',
  type: 'text',
  placeholder: 'e.g. server*, host1,host2',
}
```

**Pattern Syntax:**
- `*` wildcard: `server*` matches `server1`, `server-prod`, etc.
- Comma-separated: `host1,host2` matches multiple exact values
- Plain text: partial match on item names

### Number Filter

Numeric input for thresholds or limits:

```typescript
{
  label: 'Max Items',
  key: 'maxItems',
  type: 'number',
  placeholder: '10',
}
```

### Checkbox Filter

Single toggle option:

```typescript
{
  label: 'Show Offline',
  key: 'showOffline',
  type: 'checkbox',
}
```

### Checkbox Group

Multiple toggles for column/feature visibility:

```typescript
{
  label: 'Display Columns',
  key: 'columns',
  type: 'checkbox-group',
  defaultEnabled: true,
  items: [
    { label: 'CPU', key: 'showCpu' },
    { label: 'Memory', key: 'showMemory' },
    { label: 'Disk', key: 'showDisk' },
  ],
}
```

### Button Group

Segmented button selection:

```typescript
{
  label: 'View Mode',
  key: 'viewMode',
  type: 'button-group',
  options: [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
}
```

### Collapsible Filter Groups

For widgets with many filter options, filters can be organized into collapsible accordion sections. This improves UX by:

- Keeping essential options visible at the top
- Hiding advanced/rarely-used options in collapsed sections
- Providing clear visual grouping of related settings

**Example: Beszel System Stats widget**

The Filters tab displays:
- **Ungrouped (always visible)**: Systems, Metrics to Display
- **Temperature Settings** (collapsed by default): Temperature Sensors, Warning/Critical thresholds
- **Appearance** (collapsed by default): Show Totals, Display Options, Host Icons, Compact View
- **Usage Thresholds** (collapsed by default): Warning/Critical percentages

Users can click on group headers to expand/collapse sections. The collapsed state persists while the modal is open.

**Configuration:**

Add `group` and `groupCollapsedByDefault` properties to filter definitions:

```typescript
{
  label: 'Temperature Sensors',
  key: 'selectedTemps',
  type: 'beszel-temp-select',
  group: 'Temperature Settings',     // Group name (section header)
  groupCollapsedByDefault: true,     // Start collapsed
}
```

See [Adding Integrations](ADDING_INTEGRATIONS.md#collapsible-filter-groups) for detailed configuration instructions.

## Widget Size Options

### Default Size

Widgets have default grid sizes (width x height):

| Size | Description | Example Use |
|------|-------------|-------------|
| 2x2 | Small square | Single metric |
| 4x2 | Wide medium | Status overview |
| 4x3 | Medium | Lists with details |
| 4x4 | Large | Charts, detailed lists |
| 6x3 | Wide large | Tables, timelines |

### Minimum Size

Widgets define minimum sizes to ensure content displays properly:

```typescript
minSize: { w: 2, h: 2 }
```

### Metric Size Mode

When `supportsMetricSize` is enabled, widgets can display in a compact single-metric format, ideal for small grid sizes (2x2 or 2x3).

## Widget Feature Flags

### supportsHideLabels

When `true`, shows a "Hide Labels" toggle in Appearance settings:

```typescript
supportsHideLabels: true
```

This removes descriptive text labels, showing only values.

### supportsMetricSize

When `true`, enables compact single-metric display mode:

```typescript
supportsMetricSize: true
```

### supportsSingleMetric

When `true`, allows selecting which single metric to display:

```typescript
supportsSingleMetric: true,
singleMetricOptions: [
  { value: 'cpu', label: 'CPU Usage', format: 'percent' },
  { value: 'memory', label: 'Memory', format: 'bytes' },
]
```

## Single Metric Options

For widgets supporting single metric mode:

```typescript
singleMetricOptions: [
  {
    value: 'cpu',           // Config value
    label: 'CPU Usage',     // Display label
    colorClass: 'text-blue-400',  // Tailwind color class
    format: 'percent',      // Value format
    icon: 'M...',          // SVG path (optional)
  },
]
```

### Format Types

| Format | Description | Example |
|--------|-------------|---------|
| `number` | Plain number | 42 |
| `percent` | Percentage | 75% |
| `bytes` | Byte size | 4.2 GB |
| `speed` | Transfer rate | 125 MB/s |
| `duration` | Time duration | 2h 30m |
| `none` | Raw value | Any |

## Creating Custom Widget Visualizations

When building a new widget, implement visualization support:

```tsx
export function MyWidget({ integrationId, config, widgetId }: Props) {
  const { data, loading, error } = useWidgetData({
    integrationId,
    metric: 'my-metric',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read configuration
  const visualization = (config.visualization as string) || 'default';
  const hideLabels = (config.hideLabels as boolean) || false;
  const isMetricSize = config.metricSize === true;

  // Metrics visualization
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric value={data?.value1} />
              {!hideLabels && <div className="text-sm text-gray-500">Label 1</div>}
            </div>
            <div>
              <ScaledMetric value={data?.value2} />
              {!hideLabels && <div className="text-sm text-gray-500">Label 2</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Label 1</span>
            <span className="text-white">{data?.value1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Label 2</span>
            <span className="text-white">{data?.value2}</span>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {/* Default content */}
    </BaseWidget>
  );
}
```

## Common Visualization Components

Import from the common components library:

```typescript
import { ScaledMetric } from '../../common/ScaledMetric';
import { DonutChart, CircularGauge } from '../../common/visualizations';
```

### ScaledMetric

Auto-scaling large number display:

```tsx
<ScaledMetric value="1,234" className="text-blue-400" />
```

### DonutChart

Circular donut chart:

```tsx
<DonutChart
  data={[
    { label: 'Used', value: 75, color: '#3B82F6' },
    { label: 'Free', value: 25, color: '#374151' },
  ]}
  size={120}
  thickness={16}
/>
```

### CircularGauge

Percentage gauge:

```tsx
<CircularGauge
  value={75}
  max={100}
  size={100}
  strokeWidth={10}
  color="#3B82F6"
/>
```

## Best Practices

1. **Always provide a default visualization** - Handle unknown visualization values gracefully
2. **Respect hideLabels** - Check the flag before rendering labels
3. **Support metric size mode** - Provide a compact view for small widgets
4. **Use consistent styling** - Follow existing Tailwind classes and patterns
5. **Handle empty states** - Show appropriate messages when no data is available
6. **Optimize for performance** - Use useMemo for computed values, avoid unnecessary re-renders

## Integration-Specific Widgets

Each integration defines its own widgets in its configuration file. See the existing integration configs in `frontend/src/config/integrations/` for examples:

- `proxmox.ts` - VM/CT monitoring widgets
- `unifi.ts` - Network monitoring widgets
- `plex.ts` - Media server widgets
- `adguard.ts` - Ad blocking statistics widgets

For detailed instructions on creating new integrations with widgets, see [Adding Integrations](ADDING_INTEGRATIONS.md).

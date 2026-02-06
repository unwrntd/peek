import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  SWITCH_TEMPLATES,
  SwitchTemplate,
  PortDefinition,
  SwitchNameDisplay,
  initCustomTemplates,
  saveCustomTemplates,
} from '../../Widgets/network/SwitchPortOverlay/templates';
import { ImagePicker } from '../../common/ImagePicker';
import { settingsApi, TemplateEditorSettings } from '../../../api/client';

interface DraggingState {
  portIndex: number;
  startX: number;
  startY: number;
  startPortX: number;
  startPortY: number;
  // For multi-select dragging, store all selected ports' start positions
  selectedStartPositions?: { index: number; x: number; y: number }[];
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function TemplateEditor() {
  const [customTemplates, setCustomTemplates] = useState<SwitchTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(SWITCH_TEMPLATES[0]?.id || '');
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Editor settings (persisted to database)
  const [indicatorSize, setIndicatorSize] = useState<number>(16);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(5);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load custom templates and editor settings from API on mount
  useEffect(() => {
    // Load templates
    initCustomTemplates()
      .then((templates) => {
        setCustomTemplates(templates);
        setLoadingTemplates(false);
      })
      .catch((error) => {
        console.error('Failed to load custom templates:', error);
        setLoadingTemplates(false);
      });

    // Load editor settings
    settingsApi.getTemplateEditorSettings()
      .then((settings) => {
        setIndicatorSize(settings.indicatorSize);
        setSnapToGrid(settings.snapToGrid);
        setGridSize(settings.gridSize);
        setSettingsLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load editor settings:', error);
        setSettingsLoaded(true);
      });
  }, []);

  // Save editor settings to database when they change (debounced)
  useEffect(() => {
    if (!settingsLoaded) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save by 500ms
    saveTimeoutRef.current = setTimeout(() => {
      const settings: TemplateEditorSettings = { indicatorSize, snapToGrid, gridSize };
      settingsApi.saveTemplateEditorSettings(settings).catch((error) => {
        console.error('Failed to save editor settings:', error);
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [indicatorSize, snapToGrid, gridSize, settingsLoaded]);

  const [ports, setPorts] = useState<PortDefinition[]>([]);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [selectedPorts, setSelectedPorts] = useState<Set<number>>(new Set());
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [templateModel, setTemplateModel] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<number>(8);

  // Switch name display settings
  const [switchNameDisplay, setSwitchNameDisplay] = useState<SwitchNameDisplay>({
    show: false,
    x: 50,
    y: 10,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  });
  const [draggingName, setDraggingName] = useState<{ startX: number; startY: number; startNameX: number; startNameY: number } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddConfig, setQuickAddConfig] = useState({
    layout: 'cisco-24' as 'cisco-24' | 'cisco-48' | 'single-row' | 'dual-row',
    portCount: 24,
    startX: 20,
    startY: 40,
    spacingX: 3,
    spacingY: 20,
    portType: 'rj45' as PortDefinition['type'],
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Combined templates (built-in + custom) - memoized to prevent unnecessary re-renders
  const allTemplates = useMemo(() => [...SWITCH_TEMPLATES, ...customTemplates], [customTemplates]);

  // Snap value to grid
  const snapValue = useCallback((value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  // Load template when selection changes or when templates are loaded
  useEffect(() => {
    const template = allTemplates.find(t => t.id === selectedTemplateId);
    if (template) {
      setPorts([...template.ports]);
      setTemplateName(template.displayName);
      setTemplateModel(template.model);
      setAspectRatio(template.aspectRatio);
      setCustomImageUrl(template.image.url || '');
      setSwitchNameDisplay(template.switchNameDisplay || {
        show: false,
        x: 50,
        y: 10,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
      });
      setSelectedPort(null);
      setSelectedPorts(new Set());
    }
  }, [selectedTemplateId, allTemplates]);

  const currentTemplate = allTemplates.find(t => t.id === selectedTemplateId);
  const isCustomTemplate = customTemplates.some(t => t.id === selectedTemplateId);

  // Handle mouse down on port indicator
  const handleMouseDown = useCallback((e: React.MouseEvent, portIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Ctrl/Cmd+click to add/remove from selection
    if (e.ctrlKey || e.metaKey) {
      setSelectedPorts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(portIndex)) {
          newSet.delete(portIndex);
        } else {
          newSet.add(portIndex);
        }
        return newSet;
      });
      setSelectedPort(portIndex);
      return;
    }

    // If clicking on a port that's already selected in multi-select, drag all selected
    const isInSelection = selectedPorts.has(portIndex);

    if (isInSelection && selectedPorts.size > 1) {
      // Drag all selected ports
      const selectedStartPositions = Array.from(selectedPorts).map(idx => ({
        index: idx,
        x: ports[idx].x,
        y: ports[idx].y,
      }));

      setDragging({
        portIndex,
        startX: e.clientX,
        startY: e.clientY,
        startPortX: ports[portIndex].x,
        startPortY: ports[portIndex].y,
        selectedStartPositions,
      });
    } else {
      // Single port drag - clear multi-selection
      setSelectedPorts(new Set([portIndex]));
      setSelectedPort(portIndex);
      setDragging({
        portIndex,
        startX: e.clientX,
        startY: e.clientY,
        startPortX: ports[portIndex].x,
        startPortY: ports[portIndex].y,
      });
    }
  }, [ports, selectedPorts]);

  // Handle mouse move for dragging or selection box
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    // Handle name label dragging
    if (draggingName) {
      const deltaXPercent = ((e.clientX - draggingName.startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - draggingName.startY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(100, draggingName.startNameX + deltaXPercent));
      const newY = Math.max(0, Math.min(100, draggingName.startNameY + deltaYPercent));
      setSwitchNameDisplay(prev => ({
        ...prev,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      }));
      return;
    }

    // Handle selection box
    if (selectionBox) {
      setSelectionBox(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      } : null);
      return;
    }

    // Handle dragging
    if (!dragging) return;

    let deltaXPercent = ((e.clientX - dragging.startX) / rect.width) * 100;
    let deltaYPercent = ((e.clientY - dragging.startY) / rect.height) * 100;

    // Shift key constrains to horizontal or vertical movement
    if (e.shiftKey) {
      if (Math.abs(deltaXPercent) > Math.abs(deltaYPercent)) {
        deltaYPercent = 0; // Lock to horizontal
      } else {
        deltaXPercent = 0; // Lock to vertical
      }
    }

    // If we have multiple selected ports, move them all
    if (dragging.selectedStartPositions && dragging.selectedStartPositions.length > 1) {
      setPorts(prev => {
        const updated = [...prev];
        for (const startPos of dragging.selectedStartPositions!) {
          const rawX = Math.max(0, Math.min(100, startPos.x + deltaXPercent));
          const rawY = Math.max(0, Math.min(100, startPos.y + deltaYPercent));
          updated[startPos.index] = {
            ...updated[startPos.index],
            x: snapValue(Math.round(rawX * 100) / 100),
            y: snapValue(Math.round(rawY * 100) / 100),
          };
        }
        return updated;
      });
    } else {
      // Single port drag
      const rawX = Math.max(0, Math.min(100, dragging.startPortX + deltaXPercent));
      const rawY = Math.max(0, Math.min(100, dragging.startPortY + deltaYPercent));

      setPorts(prev => {
        const updated = [...prev];
        updated[dragging.portIndex] = {
          ...updated[dragging.portIndex],
          x: snapValue(Math.round(rawX * 100) / 100),
          y: snapValue(Math.round(rawY * 100) / 100),
        };
        return updated;
      });
    }
  }, [dragging, draggingName, selectionBox, snapValue]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    // Stop name dragging
    if (draggingName) {
      setDraggingName(null);
      return;
    }

    // Finalize selection box
    if (selectionBox && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const minX = Math.min(selectionBox.startX, selectionBox.currentX) / rect.width * 100;
      const maxX = Math.max(selectionBox.startX, selectionBox.currentX) / rect.width * 100;
      const minY = Math.min(selectionBox.startY, selectionBox.currentY) / rect.height * 100;
      const maxY = Math.max(selectionBox.startY, selectionBox.currentY) / rect.height * 100;

      // Find ports within selection box
      const selected = new Set<number>();
      ports.forEach((port, index) => {
        if (port.x >= minX && port.x <= maxX && port.y >= minY && port.y <= maxY) {
          selected.add(index);
        }
      });

      setSelectedPorts(selected);
      if (selected.size === 1) {
        setSelectedPort(Array.from(selected)[0]);
      } else if (selected.size > 1) {
        setSelectedPort(null);
      }
    }

    setDragging(null);
    setSelectionBox(null);
  }, [draggingName, selectionBox, ports]);

  // Handle mouse down on canvas (for selection box)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Start selection box
    setSelectionBox({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });

    // Clear selection if not Ctrl/Cmd-clicking
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedPorts(new Set());
      setSelectedPort(null);
    }
  }, []);

  // Add a new port at center
  const addNewPort = useCallback(() => {
    const newPortNumber = Math.max(0, ...ports.map(p => p.number)) + 1;
    setPorts(prev => [...prev, {
      number: newPortNumber,
      x: 50,
      y: 50,
      type: 'rj45',
    }]);
    const newIndex = ports.length;
    setSelectedPort(newIndex);
    setSelectedPorts(new Set([newIndex]));
  }, [ports]);

  // Update selected port position manually
  const updatePortPosition = (field: 'x' | 'y' | 'number', value: number) => {
    if (selectedPort === null) return;
    setPorts(prev => {
      const updated = [...prev];
      updated[selectedPort] = {
        ...updated[selectedPort],
        [field]: value,
      };
      return updated;
    });
  };

  // Update selected port type
  const updatePortType = (type: PortDefinition['type']) => {
    if (selectedPort === null) return;
    setPorts(prev => {
      const updated = [...prev];
      updated[selectedPort] = {
        ...updated[selectedPort],
        type,
      };
      return updated;
    });
  };

  // Delete selected port
  const deleteSelectedPort = () => {
    if (selectedPort === null) return;
    setPorts(prev => prev.filter((_, i) => i !== selectedPort));
    setSelectedPort(null);
  };

  // Generate TypeScript code for the template
  const generateCode = () => {
    const portsCode = ports.map(p => {
      const typeStr = `'${p.type}'`;
      const labelStr = p.label ? `, label: '${p.label}'` : '';
      const rowStr = p.row ? `, row: ${p.row}` : '';
      return `    { number: ${p.number}, x: ${p.x}, y: ${p.y}, type: ${typeStr}${labelStr}${rowStr} },`;
    }).join('\n');

    const templateId = templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom-template';
    const modelPatterns = templateModel ? `['${templateModel}']` : '[]';
    const switchNameDisplayCode = switchNameDisplay.show
      ? `\n  switchNameDisplay: {
    show: true,
    x: ${switchNameDisplay.x},
    y: ${switchNameDisplay.y},
    color: '${switchNameDisplay.color}',
    fontSize: ${switchNameDisplay.fontSize},
    fontWeight: '${switchNameDisplay.fontWeight}',
    textAlign: '${switchNameDisplay.textAlign}',
  },`
      : '';

    return `export const CUSTOM_TEMPLATE: SwitchTemplate = {
  id: '${templateId}',
  vendor: 'custom',
  model: '${templateModel || 'Custom'}',
  displayName: '${templateName || 'Custom Template'}',${switchNameDisplayCode}
  image: {
    url: '${customImageUrl || ''}',
  },
  aspectRatio: ${aspectRatio},
  modelPatterns: ${modelPatterns},
  ports: [
${portsCode}
  ],
};`;
  };

  // Copy code to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(generateCode());
  };

  // Bulk adjust all ports
  const bulkAdjust = (axis: 'x' | 'y', delta: number) => {
    setPorts(prev => prev.map(p => ({
      ...p,
      [axis]: Math.round((p[axis] + delta) * 100) / 100,
    })));
  };

  // Generate ports using quick add presets
  const generateQuickAddPorts = useCallback(() => {
    const { layout, portCount, startX, startY, spacingX, spacingY, portType } = quickAddConfig;
    const newPorts: PortDefinition[] = [];

    if (layout === 'cisco-24' || layout === 'cisco-48') {
      // Cisco-style: odd ports on top, even ports on bottom
      const totalPorts = layout === 'cisco-24' ? 24 : 48;
      const portsPerRow = totalPorts / 2;

      for (let i = 0; i < portsPerRow; i++) {
        // Top row - odd ports (1, 3, 5, 7...)
        newPorts.push({
          number: i * 2 + 1,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY,
          type: portType,
          row: 1,
        });
        // Bottom row - even ports (2, 4, 6, 8...)
        newPorts.push({
          number: i * 2 + 2,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY + spacingY,
          type: portType,
          row: 2,
        });
      }
    } else if (layout === 'single-row') {
      // Single row of sequential ports
      for (let i = 0; i < portCount; i++) {
        newPorts.push({
          number: i + 1,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY,
          type: portType,
        });
      }
    } else if (layout === 'dual-row') {
      // Standard dual row: 1-12 top, 13-24 bottom (or similar)
      const portsPerRow = Math.ceil(portCount / 2);

      for (let i = 0; i < portsPerRow; i++) {
        // Top row
        newPorts.push({
          number: i + 1,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY,
          type: portType,
          row: 1,
        });
      }
      for (let i = 0; i < portCount - portsPerRow; i++) {
        // Bottom row
        newPorts.push({
          number: portsPerRow + i + 1,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY + spacingY,
          type: portType,
          row: 2,
        });
      }
    }

    // Sort by port number for display
    newPorts.sort((a, b) => a.number - b.number);
    setPorts(newPorts);
    setShowQuickAdd(false);
    setSelectedPort(null);
    setSelectedPorts(new Set());
  }, [quickAddConfig]);

  // Add a row of ports
  const addPortRow = useCallback((count: number, startNum: number, y: number, startX: number, spacing: number, type: PortDefinition['type'], row?: number) => {
    const newPorts: PortDefinition[] = [];
    for (let i = 0; i < count; i++) {
      newPorts.push({
        number: startNum + i,
        x: Math.round((startX + i * spacing) * 100) / 100,
        y,
        type,
        row,
      });
    }
    setPorts(prev => [...prev, ...newPorts]);
  }, []);

  // Renumber all ports sequentially
  const renumberPorts = useCallback(() => {
    setPorts(prev => {
      // Sort by row (top first), then by x position
      const sorted = [...prev].sort((a, b) => {
        const rowA = a.row || (a.y < 50 ? 1 : 2);
        const rowB = b.row || (b.y < 50 ? 1 : 2);
        if (rowA !== rowB) return rowA - rowB;
        return a.x - b.x;
      });
      return sorted.map((p, i) => ({ ...p, number: i + 1 }));
    });
  }, []);

  // Renumber ports Cisco-style (odd top, even bottom)
  const renumberCiscoStyle = useCallback(() => {
    setPorts(prev => {
      // Split into top and bottom rows based on y position
      const topRow = prev.filter(p => p.row === 1 || p.y < 50).sort((a, b) => a.x - b.x);
      const bottomRow = prev.filter(p => p.row === 2 || p.y >= 50).sort((a, b) => a.x - b.x);

      // Assign odd numbers to top, even to bottom
      const result: PortDefinition[] = [];
      const maxLen = Math.max(topRow.length, bottomRow.length);

      for (let i = 0; i < maxLen; i++) {
        if (topRow[i]) {
          result.push({ ...topRow[i], number: i * 2 + 1, row: 1 });
        }
        if (bottomRow[i]) {
          result.push({ ...bottomRow[i], number: i * 2 + 2, row: 2 });
        }
      }

      return result.sort((a, b) => a.number - b.number);
    });
  }, []);

  // Align ports horizontally (same Y) or vertically (same X)
  const alignPorts = useCallback((direction: 'horizontal' | 'vertical') => {
    if (selectedPorts.size < 2) return;

    const indices = Array.from(selectedPorts);
    const selectedPortsList = indices.map(i => ports[i]);

    if (direction === 'horizontal') {
      // Align horizontally = same Y position (use average)
      const avgY = selectedPortsList.reduce((sum, p) => sum + p.y, 0) / selectedPortsList.length;
      const targetY = Math.round(avgY * 100) / 100;
      setPorts(prev => prev.map((p, i) => selectedPorts.has(i) ? { ...p, y: targetY } : p));
    } else {
      // Align vertically = same X position (use average)
      const avgX = selectedPortsList.reduce((sum, p) => sum + p.x, 0) / selectedPortsList.length;
      const targetX = Math.round(avgX * 100) / 100;
      setPorts(prev => prev.map((p, i) => selectedPorts.has(i) ? { ...p, x: targetX } : p));
    }
  }, [selectedPorts, ports]);

  // Create a new blank template
  const createNewTemplate = useCallback(async () => {
    const newId = `custom-${Date.now()}`;
    const newTemplate: SwitchTemplate = {
      id: newId,
      vendor: 'custom',
      model: 'Custom Switch',
      displayName: 'New Custom Template',
      image: { url: '' },
      aspectRatio: 8,
      modelPatterns: [],
      ports: [],
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    setSelectedTemplateId(newId);
    try {
      await saveCustomTemplates(updated);
      setSaveMessage({ type: 'success', text: 'New template created' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [customTemplates]);

  // Save current template
  const saveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      setSaveMessage({ type: 'error', text: 'Template name is required' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    const templateId = isCustomTemplate ? selectedTemplateId : `custom-${Date.now()}`;
    const updatedTemplate: SwitchTemplate = {
      id: templateId,
      vendor: 'custom',
      model: templateModel || 'Custom',
      displayName: templateName,
      switchNameDisplay: switchNameDisplay.show ? switchNameDisplay : undefined,
      image: { url: customImageUrl },
      aspectRatio: aspectRatio,
      modelPatterns: templateModel ? [templateModel] : [],
      ports: [...ports],
    };

    let updated: SwitchTemplate[];
    if (isCustomTemplate) {
      // Update existing custom template
      updated = customTemplates.map(t => t.id === templateId ? updatedTemplate : t);
    } else {
      // Create new custom template
      updated = [...customTemplates, updatedTemplate];
    }

    setCustomTemplates(updated);
    setSelectedTemplateId(templateId);
    setShowSaveModal(false);
    try {
      await saveCustomTemplates(updated);
      setSaveMessage({ type: 'success', text: isCustomTemplate ? 'Template saved' : 'Template created' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [templateName, templateModel, switchNameDisplay, customImageUrl, aspectRatio, ports, isCustomTemplate, selectedTemplateId, customTemplates]);

  // Delete custom template
  const deleteTemplate = useCallback(async () => {
    if (!isCustomTemplate) return;
    if (!confirm('Are you sure you want to delete this template?')) return;

    const updated = customTemplates.filter(t => t.id !== selectedTemplateId);
    setCustomTemplates(updated);
    setSelectedTemplateId(SWITCH_TEMPLATES[0]?.id || '');
    try {
      await saveCustomTemplates(updated);
      setSaveMessage({ type: 'success', text: 'Template deleted' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to delete template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [isCustomTemplate, selectedTemplateId, customTemplates]);

  // Duplicate current template as new custom
  const duplicateTemplate = useCallback(async () => {
    const newId = `custom-${Date.now()}`;
    const newTemplate: SwitchTemplate = {
      id: newId,
      vendor: 'custom',
      model: templateModel || currentTemplate?.model || 'Custom',
      displayName: `${templateName} (Copy)`,
      switchNameDisplay: switchNameDisplay.show ? switchNameDisplay : undefined,
      image: { url: customImageUrl },
      aspectRatio: aspectRatio,
      modelPatterns: [],
      ports: [...ports],
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    setSelectedTemplateId(newId);
    try {
      await saveCustomTemplates(updated);
      setSaveMessage({ type: 'success', text: 'Template duplicated' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to duplicate template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [templateName, templateModel, switchNameDisplay, customImageUrl, aspectRatio, ports, customTemplates, currentTemplate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Switch Template Editor
          </h3>
          {saveMessage && (
            <span className={`text-sm px-2 py-1 rounded ${saveMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {saveMessage.text}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={createNewTemplate}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
          <button
            onClick={duplicateTemplate}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            title="Duplicate template"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
          {isCustomTemplate && (
            <button
              onClick={deleteTemplate}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              title="Delete template"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <div className="w-px bg-gray-600 mx-1" />
          <button
            onClick={() => setShowCode(!showCode)}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {showCode ? 'Hide Code' : 'Code'}
          </button>
        </div>
      </div>

      {/* Template Selection */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Template
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <optgroup label="Built-in Templates">
              {SWITCH_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.displayName}</option>
              ))}
            </optgroup>
            {customTemplates.length > 0 && (
              <optgroup label="Custom Templates">
                {customTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="My Custom Switch"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Model Pattern
          </label>
          <input
            type="text"
            value={templateModel}
            onChange={(e) => setTemplateModel(e.target.value)}
            placeholder="USW-24-POE"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Aspect Ratio
          </label>
          <input
            type="number"
            step="0.1"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(parseFloat(e.target.value) || 8)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Image URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Image
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customImageUrl}
            onChange={(e) => setCustomImageUrl(e.target.value)}
            placeholder="/images/switches/custom.png"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={() => setShowImagePicker(true)}
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Browse
          </button>
        </div>
        {customImageUrl && (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
            <img
              src={customImageUrl}
              alt="Preview"
              className="max-h-16 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
      </div>

      {/* Switch Name Display Settings */}
      <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={switchNameDisplay.show}
              onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, show: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Switch Name</span>
          </label>

          {switchNameDisplay.show && (
            <>
              <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />

              {/* Position */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">X:</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={switchNameDisplay.x}
                  onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-xs text-gray-500">Y:</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={switchNameDisplay.y}
                  onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />

              {/* Color */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Color:</span>
                <input
                  type="color"
                  value={switchNameDisplay.color}
                  onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, color: e.target.value }))}
                  className="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
              </div>

              {/* Font Size */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Size:</span>
                <input
                  type="number"
                  min="8"
                  max="48"
                  value={switchNameDisplay.fontSize}
                  onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 14 }))}
                  className="w-14 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Font Weight */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Weight:</span>
                <select
                  value={switchNameDisplay.fontWeight}
                  onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, fontWeight: e.target.value as 'normal' | 'bold' }))}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>

              {/* Text Align */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Align:</span>
                <select
                  value={switchNameDisplay.textAlign}
                  onChange={(e) => setSwitchNameDisplay(prev => ({ ...prev, textAlign: e.target.value as 'left' | 'center' | 'right' }))}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <span className="text-xs text-gray-400 ml-2">(Drag label on canvas to position)</span>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded flex-wrap">
        {/* Add Port + Quick Add */}
        <button
          onClick={addNewPort}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Port
        </button>
        <button
          onClick={() => setShowQuickAdd(true)}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
          title="Quick add multiple ports with presets"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          Quick Add
        </button>
        <div className="relative group">
          <button
            className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center gap-1"
            title="Renumber ports"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            Renumber
          </button>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg py-1 min-w-[160px]">
              <button
                onClick={renumberPorts}
                className="w-full px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Sequential (1, 2, 3...)
              </button>
              <button
                onClick={renumberCiscoStyle}
                className="w-full px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cisco Style (odd/even)
              </button>
            </div>
          </div>
        </div>
        <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Snap</span>
        </label>
        <select
          value={gridSize}
          onChange={(e) => setGridSize(parseInt(e.target.value))}
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value={1}>1%</option>
          <option value={2}>2%</option>
          <option value={5}>5%</option>
          <option value={10}>10%</option>
        </select>
        {selectedPorts.size > 0 && snapToGrid && (
          <button
            onClick={() => {
              setPorts(prev => prev.map((p, i) =>
                selectedPorts.has(i)
                  ? { ...p, x: snapValue(p.x), y: snapValue(p.y) }
                  : p
              ));
            }}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Snap Selected
          </button>
        )}

        {/* Alignment Tools - show when multiple ports selected */}
        {selectedPorts.size >= 2 && (
          <>
            <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Align:</span>
            <button
              onClick={() => alignPorts('horizontal')}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              title="Align selected ports horizontally (same Y position)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 11h18v2H3v-2zM7 7h4v4H7V7zm0 6h4v4H7v-4zm6-6h4v4h-4V7zm0 6h4v4h-4v-4z"/>
              </svg>
              Horizontal
            </button>
            <button
              onClick={() => alignPorts('vertical')}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              title="Align selected ports vertically (same X position)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 3v18h2V3h-2zM7 7v4h4V7H7zm0 6v4h4v-4H7zm6-6v4h4V7h-4zm0 6v4h4v-4h-4z"/>
              </svg>
              Vertical
            </button>
          </>
        )}

        <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />

        {/* Bulk Adjust */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bulk:</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">X:</span>
          <button onClick={() => bulkAdjust('x', -1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-1</button>
          <button onClick={() => bulkAdjust('x', -0.5)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-0.5</button>
          <button onClick={() => bulkAdjust('x', 0.5)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+0.5</button>
          <button onClick={() => bulkAdjust('x', 1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+1</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Y:</span>
          <button onClick={() => bulkAdjust('y', -1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-1</button>
          <button onClick={() => bulkAdjust('y', -0.5)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-0.5</button>
          <button onClick={() => bulkAdjust('y', 0.5)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+0.5</button>
          <button onClick={() => bulkAdjust('y', 1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+1</button>
        </div>

        {/* Size slider */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Size:</span>
          <input
            type="range"
            min="8"
            max="32"
            value={indicatorSize}
            onChange={(e) => setIndicatorSize(parseInt(e.target.value))}
            className="w-24 h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-500 w-8">{indicatorSize}px</span>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-900">
        <div
          ref={containerRef}
          className="relative w-full cursor-crosshair select-none"
          style={{ aspectRatio: aspectRatio || 8 }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Switch Image */}
          {customImageUrl && (
            <img
              src={customImageUrl}
              alt="Switch"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* Port Indicators */}
          {ports.map((port, index) => {
            const isSelected = selectedPorts.has(index);
            const isSingleSelected = selectedPort === index;
            return (
              <div
                key={index}
                className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-move border-2 flex items-center justify-center font-bold
                  ${isSingleSelected
                    ? 'bg-yellow-400 border-yellow-600 ring-2 ring-yellow-300 z-20'
                    : isSelected
                      ? 'bg-blue-400 border-blue-600 ring-2 ring-blue-300 z-20'
                      : port.type === 'sfp' || port.type === 'sfp+'
                        ? 'bg-purple-500 border-purple-700 z-10'
                        : 'bg-green-500 border-green-700 z-10'
                  }
                  hover:scale-110 transition-transform`}
                style={{
                  left: `${port.x}%`,
                  top: `${port.y}%`,
                  width: `${indicatorSize}px`,
                  height: `${indicatorSize}px`,
                  fontSize: `${Math.max(8, indicatorSize * 0.5)}px`,
                }}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!e.ctrlKey && !e.metaKey) {
                    setSelectedPort(index);
                    setSelectedPorts(new Set([index]));
                  }
                }}
              >
                <span className="text-white drop-shadow-md">{port.number}</span>
              </div>
            );
          })}

          {/* Switch Name Label (draggable) */}
          {switchNameDisplay.show && (
            <div
              className="absolute cursor-move z-25 whitespace-nowrap select-none hover:ring-2 hover:ring-yellow-400 rounded px-1"
              style={{
                left: `${switchNameDisplay.x}%`,
                top: `${switchNameDisplay.y}%`,
                transform: switchNameDisplay.textAlign === 'center'
                  ? 'translate(-50%, -50%)'
                  : switchNameDisplay.textAlign === 'right'
                    ? 'translate(-100%, -50%)'
                    : 'translate(0, -50%)',
                color: switchNameDisplay.color,
                fontSize: `${switchNameDisplay.fontSize}px`,
                fontWeight: switchNameDisplay.fontWeight,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingName({
                  startX: e.clientX,
                  startY: e.clientY,
                  startNameX: switchNameDisplay.x,
                  startNameY: switchNameDisplay.y,
                });
              }}
            >
              Switch Name
            </div>
          )}

          {/* Selection Box */}
          {selectionBox && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none z-30"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
              }}
            />
          )}

          {/* Alignment Guides - show lines through aligned ports */}
          {selectedPorts.size >= 2 && (() => {
            const selectedPortsList = Array.from(selectedPorts).map(i => ports[i]);
            const alignmentLines: { type: 'h' | 'v'; pos: number; count: number }[] = [];

            // Find horizontal alignments (same Y)
            const yGroups = new Map<number, number>();
            selectedPortsList.forEach(p => {
              const roundedY = Math.round(p.y * 10) / 10;
              yGroups.set(roundedY, (yGroups.get(roundedY) || 0) + 1);
            });
            yGroups.forEach((count, y) => {
              if (count >= 2) alignmentLines.push({ type: 'h', pos: y, count });
            });

            // Find vertical alignments (same X)
            const xGroups = new Map<number, number>();
            selectedPortsList.forEach(p => {
              const roundedX = Math.round(p.x * 10) / 10;
              xGroups.set(roundedX, (xGroups.get(roundedX) || 0) + 1);
            });
            xGroups.forEach((count, x) => {
              if (count >= 2) alignmentLines.push({ type: 'v', pos: x, count });
            });

            return alignmentLines.map((line, i) => (
              <div
                key={`${line.type}-${line.pos}-${i}`}
                className={`absolute pointer-events-none z-5 ${
                  line.type === 'h'
                    ? 'left-0 right-0 border-t-2 border-dashed border-green-400/60'
                    : 'top-0 bottom-0 border-l-2 border-dashed border-green-400/60'
                }`}
                style={line.type === 'h' ? { top: `${line.pos}%` } : { left: `${line.pos}%` }}
              />
            ));
          })()}

          {/* Grid overlay for alignment help - dots at intersections */}
          <div className="absolute inset-0 pointer-events-none">
            {(() => {
              const dots = [];
              // Use smaller horizontal step to account for wide aspect ratio
              const xGridSize = gridSize / Math.max(1, aspectRatio / 4);
              const yGridSize = gridSize;
              const xSteps = Math.floor(100 / xGridSize) - 1;
              const ySteps = Math.floor(100 / yGridSize) - 1;
              for (let xi = 1; xi <= xSteps; xi++) {
                for (let yi = 1; yi <= ySteps; yi++) {
                  const xPct = xi * xGridSize;
                  const yPct = yi * yGridSize;
                  dots.push(
                    <div
                      key={`${xPct.toFixed(1)}-${yPct.toFixed(1)}`}
                      className={`absolute w-1 h-1 rounded-full ${snapToGrid ? 'bg-blue-400/40' : 'bg-white/20'}`}
                      style={{
                        left: `${xPct}%`,
                        top: `${yPct}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  );
                }
              }
              return dots;
            })()}
          </div>
        </div>
      </div>

      {/* Selected Port Editor */}
      {selectedPort !== null && ports[selectedPort] && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Editing Port {ports[selectedPort].number}
            </h4>
            <button
              onClick={deleteSelectedPort}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete Port
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Port Number
              </label>
              <input
                type="number"
                value={ports[selectedPort].number}
                onChange={(e) => updatePortPosition('number', parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                X Position (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={ports[selectedPort].x}
                onChange={(e) => updatePortPosition('x', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Y Position (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={ports[selectedPort].y}
                onChange={(e) => updatePortPosition('y', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Port Type
              </label>
              <select
                value={ports[selectedPort].type}
                onChange={(e) => updatePortType(e.target.value as PortDefinition['type'])}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="rj45">RJ45</option>
                <option value="sfp">SFP</option>
                <option value="sfp+">SFP+</option>
                <option value="qsfp">QSFP</option>
                <option value="combo">Combo</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p><strong>Tips:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Click <strong>Add Port</strong> to create a new indicator at center</li>
          <li>Drag indicators to reposition them</li>
          <li><strong>Hold Shift while dragging</strong> to constrain to horizontal or vertical movement</li>
          <li><strong>Click and drag</strong> on empty space to draw a selection box</li>
          <li><strong>Ctrl/Cmd+click</strong> to add/remove ports from selection</li>
          <li>Drag any selected port to move all selected ports together</li>
          <li>Use <strong>Align Horizontal</strong> to put selected ports on the same row (same Y)</li>
          <li>Use <strong>Align Vertical</strong> to put selected ports in the same column (same X)</li>
          <li>Green dashed lines show when selected ports are aligned</li>
        </ul>
        {selectedPorts.size > 1 && (
          <p className="mt-2 text-blue-400">
            <strong>{selectedPorts.size} ports selected</strong> - drag any to move all, or use alignment tools
          </p>
        )}
      </div>

      {/* Generated Code */}
      {showCode && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Generated Template Code</h4>
          <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs">
            {generateCode()}
          </pre>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {isCustomTemplate ? 'Save Template' : 'Save as New Template'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My Custom Switch"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model Pattern (for auto-detection)
                </label>
                <input
                  type="text"
                  value={templateModel}
                  onChange={(e) => setTemplateModel(e.target.value)}
                  placeholder="USW-24-POE"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Image
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="/images/switches/custom.png"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImagePicker(true)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Browse
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Aspect Ratio
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(parseFloat(e.target.value) || 8)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                {ports.length} ports configured
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {isCustomTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <ImagePicker
          value={customImageUrl}
          onChange={(url) => setCustomImageUrl(url || '')}
          onClose={() => setShowImagePicker(false)}
          allowUpload={true}
          allowUrl={true}
          allowIcons={false}
          title="Select Switch Image"
        />
      )}

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Quick Add Ports
            </h3>
            <div className="space-y-4">
              {/* Layout Preset */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Layout Preset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cisco-24', label: 'Cisco 24-Port', desc: 'Odd top, even bottom' },
                    { value: 'cisco-48', label: 'Cisco 48-Port', desc: 'Odd top, even bottom' },
                    { value: 'dual-row', label: 'Dual Row', desc: '1-12 top, 13-24 bottom' },
                    { value: 'single-row', label: 'Single Row', desc: 'Sequential in one row' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setQuickAddConfig(prev => ({
                        ...prev,
                        layout: value as typeof prev.layout,
                        portCount: value === 'cisco-24' ? 24 : value === 'cisco-48' ? 48 : prev.portCount,
                      }))}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        quickAddConfig.layout === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Port Count (for non-cisco layouts) */}
              {(quickAddConfig.layout === 'single-row' || quickAddConfig.layout === 'dual-row') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Number of Ports
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="96"
                    value={quickAddConfig.portCount}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, portCount: parseInt(e.target.value) || 24 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              {/* Position Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start X (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={quickAddConfig.startX}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, startX: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Y (%) - Top Row
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={quickAddConfig.startY}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, startY: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Horizontal Spacing (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="20"
                    value={quickAddConfig.spacingX}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, spacingX: parseFloat(e.target.value) || 3 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Row Spacing (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="50"
                    value={quickAddConfig.spacingY}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, spacingY: parseFloat(e.target.value) || 20 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Port Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Port Type
                </label>
                <select
                  value={quickAddConfig.portType}
                  onChange={(e) => setQuickAddConfig(prev => ({ ...prev, portType: e.target.value as PortDefinition['type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="rj45">RJ45</option>
                  <option value="sfp">SFP</option>
                  <option value="sfp+">SFP+</option>
                  <option value="qsfp">QSFP</option>
                  <option value="combo">Combo</option>
                </select>
              </div>

              {/* Preview Info */}
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Preview:</strong> Will create{' '}
                  {quickAddConfig.layout === 'cisco-24' ? 24 : quickAddConfig.layout === 'cisco-48' ? 48 : quickAddConfig.portCount} ports
                  {quickAddConfig.layout !== 'single-row' && ' in 2 rows'}
                  {(quickAddConfig.layout === 'cisco-24' || quickAddConfig.layout === 'cisco-48') && (
                    <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Cisco numbering: Ports 1,3,5... on top row, ports 2,4,6... on bottom row
                    </span>
                  )}
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ This will replace all existing ports in the template
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={generateQuickAddPorts}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Generate Ports
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

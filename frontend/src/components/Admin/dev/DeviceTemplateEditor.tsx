import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DEVICE_TEMPLATES,
  DeviceTemplate,
  NicDefinition,
  DeviceNameDisplay,
  DeviceType,
  DeviceVendor,
  initCustomDeviceTemplates,
  saveCustomDeviceTemplates,
} from '../../Widgets/network/DeviceOverlay/templates';
import { ImagePicker } from '../../common/ImagePicker';
import { settingsApi, TemplateEditorSettings } from '../../../api/client';

interface DraggingState {
  nicIndex: number;
  startX: number;
  startY: number;
  startNicX: number;
  startNicY: number;
  selectedStartPositions?: { index: number; x: number; y: number }[];
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function DeviceTemplateEditor() {
  const [customTemplates, setCustomTemplates] = useState<DeviceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEVICE_TEMPLATES[0]?.id || '');
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Editor settings (persisted to database)
  const [indicatorSize, setIndicatorSize] = useState<number>(16);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(5);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load custom templates and editor settings from API on mount
  useEffect(() => {
    initCustomDeviceTemplates()
      .then((templates) => {
        setCustomTemplates(templates);
        setLoadingTemplates(false);
      })
      .catch((error) => {
        console.error('Failed to load custom device templates:', error);
        setLoadingTemplates(false);
      });

    settingsApi.getDeviceTemplateEditorSettings()
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

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const settings: TemplateEditorSettings = { indicatorSize, snapToGrid, gridSize };
      settingsApi.saveDeviceTemplateEditorSettings(settings).catch((error) => {
        console.error('Failed to save editor settings:', error);
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [indicatorSize, snapToGrid, gridSize, settingsLoaded]);

  const [nics, setNics] = useState<NicDefinition[]>([]);
  const [selectedNic, setSelectedNic] = useState<number | null>(null);
  const [selectedNics, setSelectedNics] = useState<Set<number>>(new Set());
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [templateModel, setTemplateModel] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<number>(4);
  const [deviceType, setDeviceType] = useState<DeviceType>('server');

  // Device name display settings
  const [deviceNameDisplay, setDeviceNameDisplay] = useState<DeviceNameDisplay>({
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
    layout: 'dual-row' as 'single-row' | 'dual-row' | 'quad-nic',
    nicCount: 4,
    startX: 20,
    startY: 40,
    spacingX: 10,
    spacingY: 20,
    nicType: 'rj45' as NicDefinition['type'],
    includeMgmt: true,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Combined templates (built-in + custom)
  const allTemplates = useMemo(() => [...DEVICE_TEMPLATES, ...customTemplates], [customTemplates]);

  // Snap value to grid
  const snapValue = useCallback((value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  // Load template when selection changes
  useEffect(() => {
    const template = allTemplates.find(t => t.id === selectedTemplateId);
    if (template) {
      setNics([...template.nics]);
      setTemplateName(template.displayName);
      setTemplateModel(template.model);
      setAspectRatio(template.aspectRatio);
      setDeviceType(template.deviceType);
      setCustomImageUrl(template.image.url || '');
      setDeviceNameDisplay(template.deviceNameDisplay || {
        show: false,
        x: 50,
        y: 10,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
      });
      setSelectedNic(null);
      setSelectedNics(new Set());
    }
  }, [selectedTemplateId, allTemplates]);

  const currentTemplate = allTemplates.find(t => t.id === selectedTemplateId);
  const isCustomTemplate = customTemplates.some(t => t.id === selectedTemplateId);

  // Handle mouse down on NIC indicator
  const handleMouseDown = useCallback((e: React.MouseEvent, nicIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      setSelectedNics(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nicIndex)) {
          newSet.delete(nicIndex);
        } else {
          newSet.add(nicIndex);
        }
        return newSet;
      });
      setSelectedNic(nicIndex);
      return;
    }

    const isInSelection = selectedNics.has(nicIndex);

    if (isInSelection && selectedNics.size > 1) {
      const selectedStartPositions = Array.from(selectedNics).map(idx => ({
        index: idx,
        x: nics[idx].x,
        y: nics[idx].y,
      }));

      setDragging({
        nicIndex,
        startX: e.clientX,
        startY: e.clientY,
        startNicX: nics[nicIndex].x,
        startNicY: nics[nicIndex].y,
        selectedStartPositions,
      });
    } else {
      setSelectedNics(new Set([nicIndex]));
      setSelectedNic(nicIndex);
      setDragging({
        nicIndex,
        startX: e.clientX,
        startY: e.clientY,
        startNicX: nics[nicIndex].x,
        startNicY: nics[nicIndex].y,
      });
    }
  }, [nics, selectedNics]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    if (draggingName) {
      const deltaXPercent = ((e.clientX - draggingName.startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - draggingName.startY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(100, draggingName.startNameX + deltaXPercent));
      const newY = Math.max(0, Math.min(100, draggingName.startNameY + deltaYPercent));
      setDeviceNameDisplay(prev => ({
        ...prev,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      }));
      return;
    }

    if (selectionBox) {
      setSelectionBox(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      } : null);
      return;
    }

    if (!dragging) return;

    let deltaXPercent = ((e.clientX - dragging.startX) / rect.width) * 100;
    let deltaYPercent = ((e.clientY - dragging.startY) / rect.height) * 100;

    if (e.shiftKey) {
      if (Math.abs(deltaXPercent) > Math.abs(deltaYPercent)) {
        deltaYPercent = 0;
      } else {
        deltaXPercent = 0;
      }
    }

    if (dragging.selectedStartPositions && dragging.selectedStartPositions.length > 1) {
      setNics(prev => {
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
      const rawX = Math.max(0, Math.min(100, dragging.startNicX + deltaXPercent));
      const rawY = Math.max(0, Math.min(100, dragging.startNicY + deltaYPercent));

      setNics(prev => {
        const updated = [...prev];
        updated[dragging.nicIndex] = {
          ...updated[dragging.nicIndex],
          x: snapValue(Math.round(rawX * 100) / 100),
          y: snapValue(Math.round(rawY * 100) / 100),
        };
        return updated;
      });
    }
  }, [dragging, draggingName, selectionBox, snapValue]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (draggingName) {
      setDraggingName(null);
      return;
    }

    if (selectionBox && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const minX = Math.min(selectionBox.startX, selectionBox.currentX) / rect.width * 100;
      const maxX = Math.max(selectionBox.startX, selectionBox.currentX) / rect.width * 100;
      const minY = Math.min(selectionBox.startY, selectionBox.currentY) / rect.height * 100;
      const maxY = Math.max(selectionBox.startY, selectionBox.currentY) / rect.height * 100;

      const selected = new Set<number>();
      nics.forEach((nic, index) => {
        if (nic.x >= minX && nic.x <= maxX && nic.y >= minY && nic.y <= maxY) {
          selected.add(index);
        }
      });

      setSelectedNics(selected);
      if (selected.size === 1) {
        setSelectedNic(Array.from(selected)[0]);
      } else if (selected.size > 1) {
        setSelectedNic(null);
      }
    }

    setDragging(null);
    setSelectionBox(null);
  }, [draggingName, selectionBox, nics]);

  // Handle canvas mouse down for selection box
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionBox({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });

    if (!e.ctrlKey && !e.metaKey) {
      setSelectedNics(new Set());
      setSelectedNic(null);
    }
  }, []);

  // Add a new NIC at center
  const addNewNic = useCallback(() => {
    const newNicNum = nics.length + 1;
    setNics(prev => [...prev, {
      id: `nic${newNicNum}`,
      label: `NIC ${newNicNum}`,
      x: 50,
      y: 50,
      type: 'rj45',
      speed: 1000,
    }]);
    const newIndex = nics.length;
    setSelectedNic(newIndex);
    setSelectedNics(new Set([newIndex]));
  }, [nics]);

  // Update selected NIC
  const updateNic = (field: keyof NicDefinition, value: unknown) => {
    if (selectedNic === null) return;
    setNics(prev => {
      const updated = [...prev];
      updated[selectedNic] = {
        ...updated[selectedNic],
        [field]: value,
      };
      return updated;
    });
  };

  // Delete selected NIC
  const deleteSelectedNic = () => {
    if (selectedNic === null) return;
    setNics(prev => prev.filter((_, i) => i !== selectedNic));
    setSelectedNic(null);
    setSelectedNics(new Set());
  };

  // Generate TypeScript code for the template
  const generateCode = () => {
    const nicsCode = nics.map(n => {
      const speedStr = n.speed ? `, speed: ${n.speed}` : '';
      return `    { id: '${n.id}', label: '${n.label}', x: ${n.x}, y: ${n.y}, type: '${n.type}'${speedStr} },`;
    }).join('\n');

    const templateId = templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom-device';
    const modelPatterns = templateModel ? `['${templateModel}']` : '[]';
    const deviceNameDisplayCode = deviceNameDisplay.show
      ? `\n  deviceNameDisplay: {
    show: true,
    x: ${deviceNameDisplay.x},
    y: ${deviceNameDisplay.y},
    color: '${deviceNameDisplay.color}',
    fontSize: ${deviceNameDisplay.fontSize},
    fontWeight: '${deviceNameDisplay.fontWeight}',
    textAlign: '${deviceNameDisplay.textAlign}',
  },`
      : '';

    return `export const CUSTOM_DEVICE: DeviceTemplate = {
  id: '${templateId}',
  vendor: 'custom',
  model: '${templateModel || 'Custom'}',
  displayName: '${templateName || 'Custom Device'}',
  deviceType: '${deviceType}',${deviceNameDisplayCode}
  image: {
    url: '${customImageUrl || ''}',
  },
  aspectRatio: ${aspectRatio},
  modelPatterns: ${modelPatterns},
  nics: [
${nicsCode}
  ],
};`;
  };

  // Copy code to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(generateCode());
  };

  // Bulk adjust all NICs
  const bulkAdjust = (axis: 'x' | 'y', delta: number) => {
    setNics(prev => prev.map(n => ({
      ...n,
      [axis]: Math.round((n[axis] + delta) * 100) / 100,
    })));
  };

  // Generate NICs using quick add presets
  const generateQuickAddNics = useCallback(() => {
    const { layout, nicCount, startX, startY, spacingX, spacingY, nicType, includeMgmt } = quickAddConfig;
    const newNics: NicDefinition[] = [];

    // Add management NIC if enabled
    if (includeMgmt) {
      newNics.push({
        id: 'mgmt',
        label: 'MGMT',
        x: 10,
        y: 50,
        type: 'mgmt',
      });
    }

    if (layout === 'single-row') {
      for (let i = 0; i < nicCount; i++) {
        newNics.push({
          id: `nic${i + 1}`,
          label: `NIC ${i + 1}`,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY,
          type: nicType,
          speed: nicType === 'sfp+' ? 10000 : nicType === 'sfp' ? 1000 : 1000,
        });
      }
    } else if (layout === 'dual-row') {
      const perRow = Math.ceil(nicCount / 2);
      for (let i = 0; i < perRow; i++) {
        newNics.push({
          id: `nic${i + 1}`,
          label: `NIC ${i + 1}`,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY,
          type: nicType,
          speed: nicType === 'sfp+' ? 10000 : nicType === 'sfp' ? 1000 : 1000,
        });
      }
      for (let i = 0; i < nicCount - perRow; i++) {
        newNics.push({
          id: `nic${perRow + i + 1}`,
          label: `NIC ${perRow + i + 1}`,
          x: Math.round((startX + i * spacingX) * 100) / 100,
          y: startY + spacingY,
          type: nicType,
          speed: nicType === 'sfp+' ? 10000 : nicType === 'sfp' ? 1000 : 1000,
        });
      }
    } else if (layout === 'quad-nic') {
      // Standard quad-port layout
      const positions = [
        { x: startX, y: startY },
        { x: startX + spacingX, y: startY },
        { x: startX, y: startY + spacingY },
        { x: startX + spacingX, y: startY + spacingY },
      ];
      for (let i = 0; i < Math.min(nicCount, 4); i++) {
        newNics.push({
          id: `nic${i + 1}`,
          label: `NIC ${i + 1}`,
          x: positions[i].x,
          y: positions[i].y,
          type: nicType,
          speed: nicType === 'sfp+' ? 10000 : nicType === 'sfp' ? 1000 : 1000,
        });
      }
    }

    setNics(newNics);
    setShowQuickAdd(false);
    setSelectedNic(null);
    setSelectedNics(new Set());
  }, [quickAddConfig]);

  // Align NICs
  const alignNics = useCallback((direction: 'horizontal' | 'vertical') => {
    if (selectedNics.size < 2) return;

    const indices = Array.from(selectedNics);
    const selectedNicsList = indices.map(i => nics[i]);

    if (direction === 'horizontal') {
      const avgY = selectedNicsList.reduce((sum, n) => sum + n.y, 0) / selectedNicsList.length;
      const targetY = Math.round(avgY * 100) / 100;
      setNics(prev => prev.map((n, i) => selectedNics.has(i) ? { ...n, y: targetY } : n));
    } else {
      const avgX = selectedNicsList.reduce((sum, n) => sum + n.x, 0) / selectedNicsList.length;
      const targetX = Math.round(avgX * 100) / 100;
      setNics(prev => prev.map((n, i) => selectedNics.has(i) ? { ...n, x: targetX } : n));
    }
  }, [selectedNics, nics]);

  // Create a new blank template
  const createNewTemplate = useCallback(async () => {
    const newId = `custom-device-${Date.now()}`;
    const newTemplate: DeviceTemplate = {
      id: newId,
      vendor: 'custom',
      model: 'Custom Device',
      displayName: 'New Custom Device',
      deviceType: 'server',
      image: { url: '' },
      aspectRatio: 4,
      modelPatterns: [],
      nics: [],
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    setSelectedTemplateId(newId);
    try {
      await saveCustomDeviceTemplates(updated);
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

    const templateId = isCustomTemplate ? selectedTemplateId : `custom-device-${Date.now()}`;
    const updatedTemplate: DeviceTemplate = {
      id: templateId,
      vendor: 'custom' as DeviceVendor,
      model: templateModel || 'Custom',
      displayName: templateName,
      deviceType: deviceType,
      deviceNameDisplay: deviceNameDisplay.show ? deviceNameDisplay : undefined,
      image: { url: customImageUrl },
      aspectRatio: aspectRatio,
      modelPatterns: templateModel ? [templateModel] : [],
      nics: [...nics],
    };

    let updated: DeviceTemplate[];
    if (isCustomTemplate) {
      updated = customTemplates.map(t => t.id === templateId ? updatedTemplate : t);
    } else {
      updated = [...customTemplates, updatedTemplate];
    }

    setCustomTemplates(updated);
    setSelectedTemplateId(templateId);
    setShowSaveModal(false);
    try {
      await saveCustomDeviceTemplates(updated);
      setSaveMessage({ type: 'success', text: isCustomTemplate ? 'Template saved' : 'Template created' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [templateName, templateModel, deviceNameDisplay, customImageUrl, aspectRatio, deviceType, nics, isCustomTemplate, selectedTemplateId, customTemplates]);

  // Delete custom template
  const deleteTemplate = useCallback(async () => {
    if (!isCustomTemplate) return;
    if (!confirm('Are you sure you want to delete this template?')) return;

    const updated = customTemplates.filter(t => t.id !== selectedTemplateId);
    setCustomTemplates(updated);
    setSelectedTemplateId(DEVICE_TEMPLATES[0]?.id || '');
    try {
      await saveCustomDeviceTemplates(updated);
      setSaveMessage({ type: 'success', text: 'Template deleted' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to delete template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [isCustomTemplate, selectedTemplateId, customTemplates]);

  // Duplicate current template
  const duplicateTemplate = useCallback(async () => {
    const newId = `custom-device-${Date.now()}`;
    const newTemplate: DeviceTemplate = {
      id: newId,
      vendor: 'custom',
      model: templateModel || currentTemplate?.model || 'Custom',
      displayName: `${templateName} (Copy)`,
      deviceType: deviceType,
      deviceNameDisplay: deviceNameDisplay.show ? deviceNameDisplay : undefined,
      image: { url: customImageUrl },
      aspectRatio: aspectRatio,
      modelPatterns: [],
      nics: [...nics],
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    setSelectedTemplateId(newId);
    try {
      await saveCustomDeviceTemplates(updated);
      setSaveMessage({ type: 'success', text: 'Template duplicated' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to duplicate template' });
    }
    setTimeout(() => setSaveMessage(null), 2000);
  }, [templateName, templateModel, deviceNameDisplay, customImageUrl, aspectRatio, deviceType, nics, customTemplates, currentTemplate]);

  // Get NIC indicator color
  const getNicColor = (nic: NicDefinition, isSelected: boolean, isSingleSelected: boolean) => {
    if (isSingleSelected) return 'bg-yellow-400 border-yellow-600 ring-2 ring-yellow-300';
    if (isSelected) return 'bg-blue-400 border-blue-600 ring-2 ring-blue-300';

    // Color by type
    switch (nic.type) {
      case 'mgmt':
      case 'ipmi':
        return 'bg-amber-500 border-amber-700';
      case 'sfp':
      case 'sfp+':
      case 'qsfp':
        return 'bg-purple-500 border-purple-700';
      case '10gbase-t':
        return 'bg-blue-500 border-blue-700';
      default:
        return 'bg-green-500 border-green-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Device Template Editor
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
      <div className="grid grid-cols-5 gap-4">
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
              {DEVICE_TEMPLATES.map(t => (
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
            placeholder="My Custom Device"
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
            placeholder="R740, DS920+"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Device Type
          </label>
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as DeviceType)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="server">Server</option>
            <option value="nas">NAS</option>
            <option value="router">Router</option>
            <option value="firewall">Firewall</option>
            <option value="workstation">Workstation</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Aspect Ratio
          </label>
          <input
            type="number"
            step="0.1"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(parseFloat(e.target.value) || 4)}
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
            placeholder="/images/devices/custom.png"
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

      {/* Device Name Display Settings */}
      <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deviceNameDisplay.show}
              onChange={(e) => setDeviceNameDisplay(prev => ({ ...prev, show: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Device Name</span>
          </label>

          {deviceNameDisplay.show && (
            <>
              <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">X:</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={deviceNameDisplay.x}
                  onChange={(e) => setDeviceNameDisplay(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-xs text-gray-500">Y:</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={deviceNameDisplay.y}
                  onChange={(e) => setDeviceNameDisplay(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Color:</span>
                <input
                  type="color"
                  value={deviceNameDisplay.color}
                  onChange={(e) => setDeviceNameDisplay(prev => ({ ...prev, color: e.target.value }))}
                  className="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Size:</span>
                <input
                  type="number"
                  min="8"
                  max="48"
                  value={deviceNameDisplay.fontSize}
                  onChange={(e) => setDeviceNameDisplay(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 14 }))}
                  className="w-14 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <span className="text-xs text-gray-400 ml-2">(Drag label on canvas to position)</span>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded flex-wrap">
        <button
          onClick={addNewNic}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add NIC
        </button>
        <button
          onClick={() => setShowQuickAdd(true)}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
          title="Quick add multiple NICs with presets"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          Quick Add
        </button>

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

        {selectedNics.size >= 2 && (
          <>
            <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Align:</span>
            <button
              onClick={() => alignNics('horizontal')}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Align horizontally (same Y)"
            >
              Horizontal
            </button>
            <button
              onClick={() => alignNics('vertical')}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Align vertically (same X)"
            >
              Vertical
            </button>
          </>
        )}

        <div className="w-px h-6 bg-gray-400 dark:bg-gray-600" />

        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bulk:</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">X:</span>
          <button onClick={() => bulkAdjust('x', -1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-1</button>
          <button onClick={() => bulkAdjust('x', 1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+1</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Y:</span>
          <button onClick={() => bulkAdjust('y', -1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-1</button>
          <button onClick={() => bulkAdjust('y', 1)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+1</button>
        </div>

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
          style={{ aspectRatio: aspectRatio || 4 }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Device Image */}
          {customImageUrl && (
            <img
              src={customImageUrl}
              alt="Device"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* NIC Indicators */}
          {nics.map((nic, index) => {
            const isSelected = selectedNics.has(index);
            const isSingleSelected = selectedNic === index;
            return (
              <div
                key={index}
                className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-move border-2 flex items-center justify-center font-bold z-10
                  ${getNicColor(nic, isSelected, isSingleSelected)}
                  hover:scale-110 transition-transform`}
                style={{
                  left: `${nic.x}%`,
                  top: `${nic.y}%`,
                  width: `${indicatorSize}px`,
                  height: `${indicatorSize}px`,
                  fontSize: `${Math.max(8, indicatorSize * 0.45)}px`,
                }}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!e.ctrlKey && !e.metaKey) {
                    setSelectedNic(index);
                    setSelectedNics(new Set([index]));
                  }
                }}
              >
                <span className="text-white drop-shadow-md text-[0.6em]">{nic.label.substring(0, 3)}</span>
              </div>
            );
          })}

          {/* Device Name Label (draggable) */}
          {deviceNameDisplay.show && (
            <div
              className="absolute cursor-move z-25 whitespace-nowrap select-none hover:ring-2 hover:ring-yellow-400 rounded px-1"
              style={{
                left: `${deviceNameDisplay.x}%`,
                top: `${deviceNameDisplay.y}%`,
                transform: deviceNameDisplay.textAlign === 'center'
                  ? 'translate(-50%, -50%)'
                  : deviceNameDisplay.textAlign === 'right'
                    ? 'translate(-100%, -50%)'
                    : 'translate(0, -50%)',
                color: deviceNameDisplay.color,
                fontSize: `${deviceNameDisplay.fontSize}px`,
                fontWeight: deviceNameDisplay.fontWeight,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingName({
                  startX: e.clientX,
                  startY: e.clientY,
                  startNameX: deviceNameDisplay.x,
                  startNameY: deviceNameDisplay.y,
                });
              }}
            >
              Device Name
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

          {/* Grid overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {(() => {
              const dots = [];
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

      {/* Selected NIC Editor */}
      {selectedNic !== null && nics[selectedNic] && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Editing {nics[selectedNic].label}
            </h4>
            <button
              onClick={deleteSelectedNic}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete NIC
            </button>
          </div>
          <div className="grid grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                ID
              </label>
              <input
                type="text"
                value={nics[selectedNic].id}
                onChange={(e) => updateNic('id', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Label
              </label>
              <input
                type="text"
                value={nics[selectedNic].label}
                onChange={(e) => updateNic('label', e.target.value)}
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
                value={nics[selectedNic].x}
                onChange={(e) => updateNic('x', parseFloat(e.target.value) || 0)}
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
                value={nics[selectedNic].y}
                onChange={(e) => updateNic('y', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Type
              </label>
              <select
                value={nics[selectedNic].type}
                onChange={(e) => updateNic('type', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="rj45">RJ45</option>
                <option value="sfp">SFP</option>
                <option value="sfp+">SFP+</option>
                <option value="qsfp">QSFP</option>
                <option value="10gbase-t">10GBase-T</option>
                <option value="mgmt">Management</option>
                <option value="ipmi">IPMI/iLO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Speed (Mbps)
              </label>
              <input
                type="number"
                value={nics[selectedNic].speed || ''}
                onChange={(e) => updateNic('speed', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="1000"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p><strong>Tips:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Click <strong>Add NIC</strong> to create a new indicator at center</li>
          <li>Drag indicators to reposition them</li>
          <li><strong>Hold Shift while dragging</strong> to constrain to horizontal or vertical movement</li>
          <li><strong>Click and drag</strong> on empty space to draw a selection box</li>
          <li><strong>Ctrl/Cmd+click</strong> to add/remove NICs from selection</li>
          <li>Colors: <span className="text-green-400">Green</span> = RJ45, <span className="text-purple-400">Purple</span> = SFP/SFP+/QSFP, <span className="text-amber-400">Amber</span> = Management</li>
        </ul>
        {selectedNics.size > 1 && (
          <p className="mt-2 text-blue-400">
            <strong>{selectedNics.size} NICs selected</strong> - drag any to move all, or use alignment tools
          </p>
        )}
      </div>

      {/* Generated Code */}
      {showCode && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Generated Template Code</h4>
            <button
              onClick={copyCode}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Copy
            </button>
          </div>
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
                  placeholder="My Custom Device"
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
                  placeholder="R740, DS920+"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device Type
                </label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="server">Server</option>
                  <option value="nas">NAS</option>
                  <option value="router">Router</option>
                  <option value="firewall">Firewall</option>
                  <option value="workstation">Workstation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                {nics.length} NICs configured
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
          title="Select Device Image"
        />
      )}

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Quick Add NICs
            </h3>
            <div className="space-y-4">
              {/* Layout Preset */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Layout Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'single-row', label: 'Single Row', desc: 'NICs in one row' },
                    { value: 'dual-row', label: 'Dual Row', desc: 'NICs in two rows' },
                    { value: 'quad-nic', label: 'Quad NIC', desc: '2x2 grid layout' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setQuickAddConfig(prev => ({
                        ...prev,
                        layout: value as typeof prev.layout,
                        nicCount: value === 'quad-nic' ? 4 : prev.nicCount,
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

              {/* NIC Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of NICs
                </label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={quickAddConfig.nicCount}
                  onChange={(e) => setQuickAddConfig(prev => ({ ...prev, nicCount: parseInt(e.target.value) || 4 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Include Management NIC */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickAddConfig.includeMgmt}
                  onChange={(e) => setQuickAddConfig(prev => ({ ...prev, includeMgmt: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Management NIC (iDRAC/iLO)</span>
              </label>

              {/* NIC Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NIC Type
                </label>
                <select
                  value={quickAddConfig.nicType}
                  onChange={(e) => setQuickAddConfig(prev => ({ ...prev, nicType: e.target.value as NicDefinition['type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="rj45">RJ45 (1GbE)</option>
                  <option value="10gbase-t">10GBase-T (10GbE)</option>
                  <option value="sfp">SFP (1GbE Fiber)</option>
                  <option value="sfp+">SFP+ (10GbE Fiber)</option>
                  <option value="qsfp">QSFP (40GbE+)</option>
                </select>
              </div>

              {/* Position Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start X (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={quickAddConfig.startX}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, startX: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Y (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={quickAddConfig.startY}
                    onChange={(e) => setQuickAddConfig(prev => ({ ...prev, startY: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  This will replace all existing NICs in the template
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
                onClick={generateQuickAddNics}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Generate NICs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

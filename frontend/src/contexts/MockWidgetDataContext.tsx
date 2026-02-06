import React, { createContext, useContext, ReactNode } from 'react';

interface MockDataEntry {
  data: unknown;
  loading?: boolean;
  error?: string | null;
}

interface MockWidgetDataContextType {
  getMockData: (metric: string) => MockDataEntry | null;
  isMockMode: boolean;
}

const MockWidgetDataContext = createContext<MockWidgetDataContextType | null>(null);

interface MockWidgetDataProviderProps {
  children: ReactNode;
  mockData: Record<string, unknown>;
}

export function MockWidgetDataProvider({ children, mockData }: MockWidgetDataProviderProps) {
  const getMockData = (metric: string): MockDataEntry | null => {
    if (metric in mockData) {
      return { data: mockData[metric], loading: false, error: null };
    }
    // Return generic mock data structure
    return { data: mockData, loading: false, error: null };
  };

  return (
    <MockWidgetDataContext.Provider value={{ getMockData, isMockMode: true }}>
      {children}
    </MockWidgetDataContext.Provider>
  );
}

export function useMockWidgetData(): MockWidgetDataContextType | null {
  return useContext(MockWidgetDataContext);
}

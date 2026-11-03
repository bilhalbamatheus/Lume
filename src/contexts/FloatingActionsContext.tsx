import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface FloatingActionItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  iconBgColor?: string; // ex: 'bg-sky-100 text-sky-700'
  onClick: () => void;
  primary?: boolean;
}

interface FloatingActionsContextType {
  actions: FloatingActionItem[];
  setFloatingActions: (actions: FloatingActionItem[]) => void;
  clearFloatingActions: () => void;
  sheetTitle: string;
  setSheetTitle: (title: string) => void;
}

const FloatingActionsContext = createContext<FloatingActionsContextType | undefined>(undefined);

export const FloatingActionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [actions, setActions] = useState<FloatingActionItem[]>([]);
  const [sheetTitle, setSheetTitle] = useState('Ações Rápidas');

  const setFloatingActions = useCallback((newActions: FloatingActionItem[]) => {
    setActions(newActions);
  }, []);

  const clearFloatingActions = useCallback(() => {
    setActions([]);
  }, []);

  return (
    <FloatingActionsContext.Provider
      value={{
        actions,
        setFloatingActions,
        clearFloatingActions,
        sheetTitle,
        setSheetTitle
      }}
    >
      {children}
    </FloatingActionsContext.Provider>
  );
};

export const useFloatingActions = () => {
  const context = useContext(FloatingActionsContext);
  if (!context) {
    throw new Error('useFloatingActions deve ser utilizado dentro de FloatingActionsProvider');
  }
  return context;
};
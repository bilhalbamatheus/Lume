import React, { useState } from 'react';
import { DealsKanbanView } from './DealsKanbanView';
import { CreateOpportunityModal } from './CreateOpportunityModal';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { ContactProfileModal } from './ContactProfileModal';

interface DealsPageProps {
  initialFilters?: {
    status?: 'em_andamento' | 'ganha' | 'perdida' | 'congelada';
    stageId?: string;
  } | null;
}

export const DealsPage: React.FC<DealsPageProps> = ({ initialFilters }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const handleOpenContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setIsContactModalOpen(true);
  };

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 min-w-0 overflow-hidden box-border">
      <DealsKanbanView
        key={`${refreshKey}-${initialFilters?.status || 'all'}-${initialFilters?.stageId || 'all'}`}
        initialStatus={initialFilters?.status}
        initialStageId={initialFilters?.stageId}
        onOpenCreateOpportunityModal={() => setIsCreateModalOpen(true)}
        onOpenOpportunityDetail={(id) => {
          setSelectedOpportunityId(id);
          setIsDetailModalOpen(true);
        }}
        onOpenContactModal={handleOpenContact}
      />

      <CreateOpportunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      <OpportunityDetailModal
        opportunityId={selectedOpportunityId}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedOpportunityId(null);
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
        onOpenContactModal={handleOpenContact}
      />

      {isContactModalOpen && selectedContactId && (
        <ContactProfileModal
          contactId={selectedContactId}
          isOpen={isContactModalOpen}
          onClose={() => {
            setIsContactModalOpen(false);
            setSelectedContactId(null);
          }}
        />
      )}
    </div>
  );
};
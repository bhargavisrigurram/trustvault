import React from 'react';
import { VaultCopilotModal } from '../components/VaultCopilotModal';

interface VaultCopilotPageProps {
  onBack: () => void;
}

export const VaultCopilotPage: React.FC<VaultCopilotPageProps> = ({ onBack }: VaultCopilotPageProps) => {
  return (
    <div className="w-full">
      <VaultCopilotModal
        isOpen={true}
        isModal={false}
        onBack={onBack}
      />
    </div>
  );
};

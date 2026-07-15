interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '20px', color: 'var(--text)', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--dim)', maxWidth: '320px', lineHeight: '1.5', marginBottom: action ? '20px' : '0' }}>
        {description}
      </p>
      {action}
    </div>
  );
}

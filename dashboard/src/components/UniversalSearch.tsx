import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  User, 
  Mail, 
  Ticket, 
  Shield, 
  LayoutDashboard, 
  ArrowRight,
  History,
  Info
} from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme/theme';
import axios from 'axios';

interface SearchResult {
  id: string;
  type: 'plugin' | 'user' | 'email' | 'ticket';
  title: string;
  subtitle: string;
  target: string; // The section name or URL to navigate to
}

interface UniversalSearchProps {
  guildId: string;
  onNavigate: (section: string, params?: any) => void;
  accessiblePlugins: string[];
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({ guildId, onNavigate, accessiblePlugins }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const plugins = [
    { id: 'dashboard', name: 'Overview', icon: <LayoutDashboard size={14} /> },
    { id: 'moderation', name: 'Moderation', icon: <Shield size={14} /> },
    { id: 'economy', name: 'Economy', icon: <Info size={14} /> },
    { id: 'word-filter-settings', name: 'Word Filter', icon: <Info size={14} /> },
    { id: 'email-client', name: 'Emails', icon: <Mail size={14} /> },
    { id: 'tickets', name: 'Tickets', icon: <Ticket size={14} /> },
    { id: 'feedback', name: 'Feedback', icon: <Info size={14} /> },
    { id: 'welcome-gate', name: 'Welcome Gate', icon: <Info size={14} /> },
    { id: 'channel-rules', name: 'Channel Rules', icon: <Info size={14} /> },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const localResults: SearchResult[] = [];

        // 1. Search Plugins
        const matchingPlugins = plugins.filter(p => 
          p.name.toLowerCase().includes(query.toLowerCase()) && 
          (p.id === 'dashboard' || accessiblePlugins.includes(p.id.split('-')[0]) || accessiblePlugins.includes(p.id))
        );
        
        matchingPlugins.forEach(p => {
          localResults.push({
            id: p.id,
            type: 'plugin',
            title: p.name,
            subtitle: 'Navigation',
            target: p.id
          });
        });

        // 2. Search Discord Users (for Audit Logs)
        try {
          const userRes = await axios.get(`/api/economy/search-users/${guildId}?q=${query}`);
          userRes.data.slice(0, 3).forEach((m: any) => {
            localResults.push({
              id: m.user.id,
              type: 'user',
              title: m.user.username,
              subtitle: `View Audit Logs for ${m.user.id}`,
              target: 'logs' // We'll pass the userId as a param if we can
            });
          });
        } catch (e) {
          console.error('User search failed', e);
        }

        // 3. Search Emails/Tickets (Placeholder Logic - would hit specific endpoints)
        if (accessiblePlugins.includes('email-client')) {
           // Push a generic "Search in Emails" result
           localResults.push({
             id: 'email-search',
             type: 'email',
             title: `Search emails for "${query}"`,
             subtitle: 'Search email client content',
             target: 'email-client'
           });
        }

        setResults(localResults);
        setIsOpen(true);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, guildId, accessiblePlugins]);

  return (
    <div style={{ position: 'relative' }} ref={searchRef}>
      <input 
        type="text" 
        placeholder="Search everything..." 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        style={{ 
          background: '#252D3E', 
          border: '1px solid #3E455633', 
          borderRadius: '8px', 
          padding: '8px 16px 8px 36px', 
          color: '#FFFFFF', 
          fontSize: '14px', 
          width: '300px',
          outline: 'none',
          transition: 'all 0.2s'
        }}
      />
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: '#FFFFFF' }}>
        <Search size={14} />
      </span>

      {isOpen && (results.length > 0 || loading) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: '#242C3D',
          borderRadius: '12px',
          border: '1px solid #3E4556',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          zIndex: 1000,
          overflow: 'hidden',
          padding: '8px'
        }}>
          {loading ? (
            <div style={{ padding: '12px', color: '#B9C3CE', fontSize: '13px', textAlign: 'center' }}>Searching...</div>
          ) : (
            <>
              {results.map((result) => (
                <div 
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    onNavigate(result.target, { searchParam: result.id });
                    setIsOpen(false);
                    setQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2F3647')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '6px', 
                    background: '#1A1E2E', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: colors.primary
                  }}>
                    {result.type === 'plugin' && <LayoutDashboard size={16} />}
                    {result.type === 'user' && <User size={16} />}
                    {result.type === 'email' && <Mail size={16} />}
                    {result.type === 'ticket' && <Ticket size={16} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{result.title}</div>
                    <div style={{ fontSize: '11px', color: '#8A92A0' }}>{result.subtitle}</div>
                  </div>
                  <ArrowRight size={14} color="#8A92A0" />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
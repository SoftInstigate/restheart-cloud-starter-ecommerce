import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@restheart-cloud/kit-react';
import { Alert } from '../../../ui/alert/Alert';
import './NewTeam.css';

export default function NewTeam() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [teamName, setTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTeam = async (e: FormEvent) => {
    e.preventDefault();
    if (!teamName) return;

    setSaving(true);
    setError(null);
    try {
      await auth.createTeam(teamName);
      navigate('/teams');
    } catch (err: unknown) {
      setSaving(false);
      const e = err as { message?: string };
      setError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="card">
      <Link to="/teams" className="back-link">&larr; Back to teams</Link>
      <h2>Create a new team</h2>

      {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

      <form onSubmit={createTeam} noValidate className="account-form">
        <div className="form-field">
          <label htmlFor="team-name">Team name</label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Acme Corp"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create team'}
        </button>
      </form>
    </section>
  );
}

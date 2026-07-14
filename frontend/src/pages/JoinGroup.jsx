import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as groupsApi from '../api/groups';
import AppLayout from '../components/common/AppLayout';
import Card from '../components/common/Card';

export default function JoinGroup() {
    const { inviteCode } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);

    useEffect(() => {
        groupsApi
            .joinByInviteCode(inviteCode)
            .then((group) => navigate(`/groups/${group._id}`, { replace: true }))
            .catch(() => setError('This invite link is invalid or has expired.'));
    }, [inviteCode, navigate]);

    if (error) {
        return (
            <AppLayout>
                <Card>
                    <p className="text-sm text-debt">{error}</p>
                    <Link to="/groups" className="mt-2 inline-block text-sm text-ink-muted hover:underline">
                        ← Back to your groups
                    </Link>
                </Card>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <p className="text-sm text-ink-muted">Joining group…</p>
        </AppLayout>
    );
}
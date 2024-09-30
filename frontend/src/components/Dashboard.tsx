import React, { useEffect, useState } from 'react';

interface User {
  username: string;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/user', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setUser(data));
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.username}!</p>
      <h2>Your Repositories</h2>
      <RepoList username={user.username} />
    </div>
  );
}

export default Dashboard;

interface Repo {
  id: number;
  name: string;
  description: string;
  html_url: string;
}

const RepoList: React.FC<{ username: string }> = ({ username }) => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch(`https://api.github.com/users/${username}/repos`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch repositories');
        }
        const data = await response.json();
        setRepos(data);
      } catch (err) {
        setError('Error fetching repositories');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [username]);

  if (loading) return <div>Loading repositories...</div>;
  if (error) return <div>{error}</div>;

  return (
    <ul>
      {repos.map(repo => (
        <li key={repo.id}>
          <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
            {repo.name}
          </a>
          {repo.description && <p>{repo.description}</p>}
        </li>
      ))}
    </ul>
  );
};

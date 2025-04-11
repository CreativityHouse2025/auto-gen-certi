'use client';
import { useState } from 'react';

export default function CertificateForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const generateCertificate = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, url }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate certificates');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${fullName}_certificate.zip`;
      link.click();
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  return (
    <div className="certificate-form">
      {success && (
        <div className="success-message">
          Certificates generated successfully! Check your downloads.
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <input
        type="text"
        value={fullName}
        placeholder="Enter your full name"
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      
      <input
        type="email"
        value={email}
        placeholder="Enter your email"
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
      <input
        type="text"
        value={url}
        placeholder="Enter URL"
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      
      <button 
        onClick={generateCertificate} 
        disabled={loading || !fullName || !email || !url}
      >
        {loading ? 'Generating...' : 'Generate Certificate'}
      </button>
    </div>
  );
}
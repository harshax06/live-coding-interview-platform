import { useState } from 'react';
import Editor from '@monaco-editor/react';

const LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'Java', value: 'java' },
];

function App() {
  const [language, setLanguage] = useState('javascript');

  return (
      <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
          }}
      >
        {/* Top Bar */}
        <header
            style={{
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              background: '#1e1e1e',
              color: '#fff',
            }}
        >
          <div>
            <strong>Interview Room</strong>
            <span style={{ marginLeft: '12px' }}>
            Room: ABC123
          </span>
          </div>

          <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
            ))}
          </select>
        </header>

        {/* Main Area */}
        <main
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
            }}
        >
          {/* Editor */}
          <section
              style={{
                flex: 1,
                minWidth: 0,
              }}
          >
            <Editor
                height="100%"
                language={language}
                defaultValue="// Start coding here"
                theme="vs-dark"
                options={{
                  minimap: {
                    enabled: true,
                  },
                }}
            />
          </section>

          {/* Placeholder Panels */}
          <aside
              style={{
                width: '300px',
                background: '#252526',
                color: '#fff',
                padding: '16px',
              }}
          >
            <div
                style={{
                  height: '50%',
                  border: '1px solid #555',
                  marginBottom: '16px',
                  padding: '12px',
                }}
            >
              Video Panel
            </div>

            <div
                style={{
                  height: '50%',
                  border: '1px solid #555',
                  padding: '12px',
                }}
            >
              Run Output
            </div>
          </aside>
        </main>
      </div>
  );
}

export default App;
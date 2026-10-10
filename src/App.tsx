import { useHashRoute } from './router';
import { getToolById } from './tools/registry';
import { HomePage } from './pages/HomePage';
import { ToolPage } from './pages/ToolPage';
import { ComingSoonPage } from './pages/ComingSoonPage';

export function App() {
  const { toolId, navigate } = useHashRoute();

  if (toolId) {
    const tool = getToolById(toolId);
    if (!tool) {
      return <ComingSoonPage title="工具不存在" onBack={() => navigate('home')} variant="missing" />;
    }
    if (tool.status === 'coming-soon' || !tool.component) {
      return (
        <ComingSoonPage
          title={tool.name}
          desc={tool.desc}
          onBack={() => navigate('home')}
        />
      );
    }
    const ToolComp = tool.component;
    return (
      <ToolPage tool={tool} onBack={() => navigate('home')}>
        <ToolComp />
      </ToolPage>
    );
  }

  return <HomePage navigate={navigate} />;
}
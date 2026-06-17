import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Pipeline from "@/pages/Pipeline";
import Coverage from "@/pages/Coverage";
import Workflows from "@/pages/Workflows";
import Statistics from "@/pages/Statistics";
import Settings from "@/pages/Settings";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function App() {
  const { connect, disconnect } = useWebSocket();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

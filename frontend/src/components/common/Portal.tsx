import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

/**
 * Portal component gắn trực tiếp phần tử con vào document.body.
 * Đảm bảo Modal / Pop-up che phủ 100% viewport (kể cả Header và Sidebar),
 * triệt tiêu hoàn toàn lỗi bị hở vệt trắng phía trên do Header z-index.
 */
export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
}

export default Portal;


import { createContext, useContext, type ReactNode } from "react";

// Lets a page inject content into AppLayout's right rail (e.g. filters).
type SetRail = (node: ReactNode | null) => void;

export const RightRailContext = createContext<SetRail>(() => {});

export const useSetRightRail = () => useContext(RightRailContext);

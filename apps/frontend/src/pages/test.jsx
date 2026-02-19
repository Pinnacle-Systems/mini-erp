import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  MessageSquare,
  Music,
  Calendar,
  Settings,
  Map,
  Camera,
  Cloud,
} from "lucide-react";

// Mock Data for the Apps inside the folder
const apps = [
  { id: 1, name: "Mail", icon: Mail, color: "bg-blue-500" },
  { id: 2, name: "Messages", icon: MessageSquare, color: "bg-green-500" },
  { id: 3, name: "Music", icon: Music, color: "bg-red-500" },
  {
    id: 4,
    name: "Calendar",
    icon: Calendar,
    color: "bg-white text-black border border-gray-200",
  },
  { id: 5, name: "Settings", icon: Settings, color: "bg-gray-500" },
  { id: 6, name: "Maps", icon: Map, color: "bg-green-600" },
  { id: 7, name: "Photos", icon: Camera, color: "bg-yellow-500" },
  { id: 8, name: "Weather", icon: Cloud, color: "bg-blue-400" },
  {
    id: 9,
    name: "Close",
    icon: X,
    color: "bg-gray-200 text-gray-600",
    action: "close",
  },
];

export default function IosFolder() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close folder if clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
      <div className="relative" ref={containerRef}>
        {/* The Motion Container (Morphs from Button to Folder) */}
        <motion.div
          layout
          // This transition config matches iOS physics (snappy but smooth)
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          onClick={() => !isOpen && setIsOpen(true)}
          className={`relative overflow-hidden ${
            isOpen
              ? "w-[320px] h-[360px] rounded-[36px] bg-white/20 backdrop-blur-2xl border border-white/10 shadow-2xl"
              : "w-20 h-20 rounded-[24px] bg-white/10 hover:bg-white/20 backdrop-blur-md cursor-pointer border border-white/5"
          }`}
          style={{ zIndex: 10 }}
        >
          {/* CONTENT SWITCHER */}
          <AnimatePresence mode="wait">
            {/* 1. COLLAPSED STATE (Mini Grid) */}
            {!isOpen ? (
              <motion.div
                key="closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-3 gap-1 p-3 w-full h-full"
              >
                {apps.slice(0, 9).map((app) => (
                  <div
                    key={app.id}
                    className={`w-full h-full rounded-sm opacity-90 ${app.color === "bg-white text-black border border-gray-200" ? "bg-white" : app.color}`}
                  />
                ))}
              </motion.div>
            ) : (
              /* 2. EXPANDED STATE (Full App Grid) */
              <motion.div
                key="open"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="flex flex-col w-full h-full p-6"
              >
                {/* Folder Title */}
                <motion.h3
                  layout="position"
                  className="text-lg font-medium text-white/90 mb-6 text-center tracking-tight"
                >
                  Productivity
                </motion.h3>

                {/* App Grid */}
                <div className="grid grid-cols-3 gap-6 place-items-center">
                  {apps.map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-col items-center gap-2 group cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (app.action === "close") setIsOpen(false);
                      }}
                    >
                      {/* App Icon */}
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${app.color} transition-transform group-hover:scale-105 active:scale-95`}
                      >
                        <app.icon size={26} />
                      </div>
                      {/* App Label */}
                      <span className="text-xs text-white/80 font-medium">
                        {app.name}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Backdrop Overlay (Darkens background when open) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)} // Click outside closes it
            />
          )}
        </AnimatePresence>
      </div>

      {/* Background hint */}
      <div className="absolute bottom-12 text-zinc-500 text-sm font-mono">
        Click the folder
      </div>
    </div>
  );
}

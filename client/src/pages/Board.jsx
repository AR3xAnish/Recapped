import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import api from "../services/api";
import { Highlight } from "../App";

// Draggable Card Component
function ActionItemCard({ item }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : undefined,
    cursor: "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-paper-cream border p-4 transition-shadow select-none ${
        isDragging
          ? "shadow-lg border-ink-navy cursor-grabbing"
          : "border-muted-sage/30 hover:border-ink-navy"
      } ${
        item.confidence === "high"
          ? "border-l-4 border-l-highlighter-gold"
          : "border-l-4 border-l-muted-sage"
      }`}
    >
      <div className="text-sm font-semibold text-ink-navy mb-2 leading-relaxed">
        {item.confidence === "high" ? (
          <Highlight>{item.description}</Highlight>
        ) : (
          item.description
        )}
      </div>

      <div className="space-y-1.5 text-[11px] font-mono text-muted-sage">
        <div className="flex justify-between">
          <span>OWNER:</span>
          <span className="text-ink-navy font-bold">{item.owner}</span>
        </div>
        {item.deadline && (
          <div className="flex justify-between">
            <span>DUE DATE:</span>
            <span className="text-ink-navy">{item.deadline}</span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 border-t border-muted-sage/10 mt-1.5">
          <span>MEETING:</span>
          <Link
            to={`/meetings/${item.meetingId}`}
            className="text-ink-navy underline hover:text-muted-sage truncate max-w-[150px]"
            onClick={(e) => e.stopPropagation()} // Prevent click drag conflicts
          >
            {item.meetingTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}

// Droppable Column Component
function Column({ id, title, children }) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[500px] border border-muted-sage/20 p-5 transition-colors duration-200 bg-paper-cream/20 flex flex-col ${
        isOver ? "bg-ink-navy/5 border-ink-navy" : ""
      }`}
    >
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-sage mb-4 border-b border-muted-sage/20 pb-2 flex justify-between items-center">
        <span>{title}</span>
        <span className="bg-ink-navy/5 border border-muted-sage/30 text-ink-navy px-2 py-0.5 text-[10px] font-semibold">
          {React.Children.count(children)}
        </span>
      </h3>
      <div className="space-y-4 flex-grow">
        {React.Children.count(children) > 0 ? (
          children
        ) : (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-muted-sage/10 text-xs font-mono text-muted-sage/40 py-12">
            [ Empty Registry ]
          </div>
        )}
      </div>
    </div>
  );
}

// Main Board Component
export default function Board() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [selectedMeeting, setSelectedMeeting] = useState("all");

  const fetchActionItems = async () => {
    try {
      const response = await api.get("/action-items");
      setItems(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch action item board registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActionItems();
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id;
    const newStatus = over.id; // "todo", "in_progress", "done"

    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem || targetItem.status === newStatus) return;

    // Optimistic UI state update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
    );

    try {
      await api.patch(`/action-items/${targetItem.meetingId}/${itemId}`, {
        status: newStatus,
      });
    } catch (err) {
      console.error("Failed to persist status change:", err);
      // Revert state on failure
      fetchActionItems();
    }
  };

  // Get unique owners & meetings for filter bars
  const owners = ["all", ...new Set(items.map((i) => i.owner).filter(Boolean))];
  const meetings = [
    "all",
    ...new Set(items.map((i) => i.meetingTitle).filter(Boolean)),
  ];

  // Apply filters
  const filteredItems = items.filter((item) => {
    const matchOwner =
      selectedOwner === "all" ||
      item.owner.toLowerCase() === selectedOwner.toLowerCase();
    const matchMeeting =
      selectedMeeting === "all" ||
      item.meetingTitle.toLowerCase() === selectedMeeting.toLowerCase();
    return matchOwner && matchMeeting;
  });

  const todoItems = filteredItems.filter((i) => i.status === "todo");
  const inProgressItems = filteredItems.filter((i) => i.status === "in_progress");
  const doneItems = filteredItems.filter((i) => i.status === "done");

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-24 px-8 text-center font-mono text-xs text-muted-sage">
        <span>[ Fetching board registry logs... ]</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 text-xs font-mono mb-8">
          BOARD ERROR: {error}
        </div>
        <Link to="/" className="text-ink-navy font-bold underline hover:text-muted-sage text-sm">
          &larr; Return to Ledger
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-16 px-8">
      {/* Board Header */}
      <div className="pb-8 border-b border-muted-sage/30 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage">
          <span>BOARD SHEET NO: 01</span>
          <span>ENTRIES: {filteredItems.length}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy mt-4 tracking-tight">
          Action Item commitments Board
        </h1>
        <p className="text-muted-sage mt-2 text-base max-w-xl font-normal leading-relaxed font-sans">
          A synchronized visual board displaying extracted action items across meeting logs. Drag items to update commitments.
        </p>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-6 mt-8 p-5 border border-muted-sage/20 bg-paper-cream/40 text-xs font-mono">
          <div className="flex flex-col space-y-1.5 min-w-[200px]">
            <label className="text-[10px] text-muted-sage uppercase">Filter by Scribe Owner</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="bg-transparent border border-muted-sage/30 text-ink-navy px-3 py-1.5 outline-none cursor-pointer focus:border-ink-navy font-sans"
            >
              {owners.map((owner, idx) => (
                <option key={idx} value={owner}>
                  {owner === "all" ? "— Show All Scribes —" : owner}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1.5 min-w-[200px]">
            <label className="text-[10px] text-muted-sage uppercase">Filter by meeting log</label>
            <select
              value={selectedMeeting}
              onChange={(e) => setSelectedMeeting(e.target.value)}
              className="bg-transparent border border-muted-sage/30 text-ink-navy px-3 py-1.5 outline-none cursor-pointer focus:border-ink-navy font-sans"
            >
              {meetings.map((m, idx) => (
                <option key={idx} value={m}>
                  {m === "all" ? "— Show All Meeting Logs —" : m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board Drag Context */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Column id="todo" title="To Do">
            {todoItems.map((item) => (
              <ActionItemCard key={item.id} item={item} />
            ))}
          </Column>
          <Column id="in_progress" title="In Progress">
            {inProgressItems.map((item) => (
              <ActionItemCard key={item.id} item={item} />
            ))}
          </Column>
          <Column id="done" title="Done">
            {doneItems.map((item) => (
              <ActionItemCard key={item.id} item={item} />
            ))}
          </Column>
        </div>
      </DndContext>
    </div>
  );
}

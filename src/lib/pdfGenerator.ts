// src/lib/pdfGenerator.ts
'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Augments jsPDF prototype
import type { Task, Priority } from './types';
import { format } from 'date-fns';

// Define an interface for jsPDF with autoTable - this helps with TypeScript
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

const mapPriorityToLabel = (priority: Priority): string => {
  switch (priority) {
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    case 'none':
    default: return 'None';
  }
};

const formatTasksForPdf = (tasks: Task[], depth = 0): Array<Array<string>> => {
  const rows: Array<Array<string>> = [];
  tasks.forEach(task => {
    const indent = '  '.repeat(depth);
    rows.push([
      `${indent}${task.text}`,
      task.dueDate ? format(new Date(task.dueDate), 'PP') : '-',
      mapPriorityToLabel(task.priority),
      task.assignedTo || '-',
      task.status || '-',
      task.completed ? 'Yes' : 'No',
      task.notes ? (task.notes.length > 40 ? task.notes.substring(0, 37) + '...' : task.notes) : '-',
      task.subtasks && task.subtasks.length > 0 ? `${task.subtasks.length} subtask(s)` : '-'
    ]);
    // If we want to list subtasks directly under parent in separate rows:
    // if (task.subtasks && task.subtasks.length > 0) {
    //   rows.push(...formatTasksForPdf(task.subtasks, depth + 1));
    // }
  });
  return rows;
};

export const generateTasksPdf = (tasks: Task[]) => {
  const doc = new jsPDF({ orientation: 'landscape' }) as jsPDFWithAutoTable;
  
  // Approximate theme colors (ideally, these would be more dynamic or configurable)
  const themeColors = {
    primaryFill: [60, 179, 113], // Teal/Greenish for header fill
    primaryText: [255, 255, 255], // White for header text
    defaultText: [0, 0, 0], // Black for body text
  };

  doc.setFontSize(18);
  doc.setTextColor(themeColors.defaultText[0], themeColors.defaultText[1], themeColors.defaultText[2]);
  doc.text('My Task List', 14, 22);
  doc.setFontSize(11);

  const tableHeaders = [['Task Name', 'Due Date', 'Priority', 'Assigned To', 'Status', 'Completed', 'Notes', 'Subtasks']];
  const tableBody = formatTasksForPdf(tasks);

  doc.autoTable({
    head: tableHeaders,
    body: tableBody,
    startY: 30,
    theme: 'grid', // 'striped', 'grid', or 'plain'
    headStyles: {
      fillColor: themeColors.primaryFill,
      textColor: themeColors.primaryText,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak', // Important for text wrapping
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 'auto', minCellWidth: 50 }, // Task Name
      1: { cellWidth: 25, halign: 'center' },   // Due Date
      2: { cellWidth: 20, halign: 'center' },   // Priority
      3: { cellWidth: 30, halign: 'center' },   // Assigned To
      4: { cellWidth: 25, halign: 'center' },   // Status
      5: { cellWidth: 20, halign: 'center' },   // Completed
      6: { cellWidth: 40 },  // Notes
      7: { cellWidth: 25, halign: 'center' },  // Subtasks count
    },
    didDrawPage: (data: any) => {
      // Footer with page number
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 10
      );
    },
  });

  doc.save('task-list.pdf');
};

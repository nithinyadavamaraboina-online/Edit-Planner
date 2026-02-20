
import { Worker, Workload, ProductionPlan, DayPlan, TaskAssignment, Bottlenecks, PlanSummary } from "../types";
import { GoogleGenAI } from "@google/genai";

// --- HEURISTIC ALGORITHM (FALLBACK) ---
// Used when no API Key is provided
const generateHeuristicPlan = async (
  workers: Worker[],
  workload: Workload,
  leaves: Record<string, number[]> = {},
  startDay: number = 1
): Promise<ProductionPlan> => {
  
  let remainingGens = workload.aiVideos;
  let remainingNormalEdits = workload.normalVideos;
  let aiReadyToEditQueue = 0; // Backlog from previous days
  
  const schedule: DayPlan[] = [];
  let day = startDay;
  // Safety break to prevent infinite loops if logic fails
  const MAX_DAYS = startDay + (workload.deadlineDays * 2) + 10; 

  let totalGensCompleted = 0;
  let totalEditsCompleted = 0;

  // Track bottlenecks for summary
  let genBottleneckDays = 0;
  let editBottleneckDays = 0;

  // Pre-calculate total intern capacity to determine if we EVER need editors
  const allInterns = workers.filter(w => w.role === 'Intern');
  const totalInternDailyCap = allInterns.reduce((sum, w) => sum + w.genCapacity, 0);

  while ((remainingGens > 0 || remainingNormalEdits > 0 || aiReadyToEditQueue > 0) && day <= MAX_DAYS) {
    const dailyAssignments: Record<string, TaskAssignment> = {};
    
    // Create localized capacity map for this specific day accounting for leaves
    const workersForToday = workers.map(w => {
      const isOnLeave = leaves[w.id]?.includes(day);
      return {
        ...w,
        currentGenCap: isOnLeave ? 0 : w.genCapacity,
        currentEditCap: isOnLeave ? 0 : w.editCapacity,
        isOnLeave
      };
    });

    // Initialize assignments
    workersForToday.forEach(w => {
      dailyAssignments[w.id] = {
        workerId: w.id,
        person: w.name,
        role: w.role,
        generations: 0,
        edits: 0,
        isOnLeave: w.isOnLeave
      };
    });

    let dailyTotalGen = 0;
    let dailyTotalEdit = 0;

    // --- PHASE 1: GENERATIONS ---
    const editors = workersForToday.filter(w => w.role !== 'Intern');
    const interns = workersForToday.filter(w => w.role === 'Intern');
    
    // PACING CALCULATION
    // Instead of maxing out immediately, we calculate what is needed to finish on time.
    // Days Remaining relative to the Project Deadline (not MAX_DAYS)
    const projectDaysRemaining = Math.max(1, (startDay + workload.deadlineDays) - day);
    const idealDailyGenPace = Math.ceil(remainingGens / projectDaysRemaining);
    
    // Ensure we generate enough to keep editors fed, but don't over-generate if pacing is lower
    // We assume editors can handle the pacing volume + normal videos
    const minNeededForFlow = 0; // Relaxed flow constraint, relying on backlog

    const targetGenToday = Math.max(idealDailyGenPace, minNeededForFlow);

    // 1. Assign to Interns (PACED)
    const totalInternGenToday = interns.reduce((sum, i) => sum + i.currentGenCap, 0);
    
    if (remainingGens > 0 && totalInternGenToday > 0) {
      // Cap assignment at the Target Pace, but clamp to available capacity
      // If we are behind schedule (target > cap), we max out cap.
      // If we are ahead (target < cap), we only do target.
      const amountForInterns = Math.min(remainingGens, totalInternGenToday, targetGenToday);
      
      let assignedCount = 0;
      const activeInterns = interns.filter(i => i.currentGenCap > 0);
      activeInterns.forEach((intern, index) => {
        let share = Math.floor(amountForInterns * (intern.currentGenCap / totalInternGenToday));
        // Distribute remainder to last intern
        if (index === activeInterns.length - 1) share = amountForInterns - assignedCount;
        
        dailyAssignments[intern.id].generations = share;
        assignedCount += share;
      });

      remainingGens -= assignedCount;
      dailyTotalGen += assignedCount;
    }

    // 2. Assign to Editors (ONLY IF ABSOLUTELY NECESSARY)
    // Logic: If interns can finish the remaining work within the deadline, DO NOT use editors.
    // Even if it means editors are idle today.
    if (remainingGens > 0) {
        // Theoretical capacity of interns for remaining days (assuming no leaves for simplicity in this check)
        const internCapacityRemaining = totalInternDailyCap * projectDaysRemaining;

        // Only assign to editors if we have a GENUINE deficit against the deadline
        if (remainingGens > internCapacityRemaining) {
            const deficit = remainingGens - internCapacityRemaining;
            const catchUpAmount = Math.ceil(deficit / projectDaysRemaining);
            const amountForEditors = Math.min(catchUpAmount, remainingGens);

            if (amountForEditors > 0) {
                const activeEditorsGen = editors.filter(e => e.currentGenCap > 0);
                const totalEdGenToday = activeEditorsGen.reduce((sum, e) => sum + e.currentGenCap, 0);

                if (totalEdGenToday > 0) {
                   let assignedCount = 0;
                   activeEditorsGen.forEach((ed, index) => {
                       let share = Math.floor(amountForEditors * (ed.currentGenCap / totalEdGenToday));
                       if (index === activeEditorsGen.length - 1) share = amountForEditors - assignedCount;
                       
                       dailyAssignments[ed.id].generations = share;
                       assignedCount += share;
                   });

                   remainingGens -= assignedCount;
                   dailyTotalGen += assignedCount;
                }
            }
        }
    }

    // --- PHASE 2: DISTRIBUTE EDITS ---
    const distributeEdits = (amount: number, targetEditors: typeof editors) => {
      if (amount <= 0 || targetEditors.length === 0) return 0;
      let assigned = 0;
      let iterations = 0;

      while (assigned < amount && iterations < 10) {
        const remainingToAssign = amount - assigned;
        const potentials = targetEditors.map(e => {
          const genAssigned = dailyAssignments[e.id].generations;
          const editAssigned = dailyAssignments[e.id].edits;
          const genUsage = e.currentGenCap > 0 ? (genAssigned / e.currentGenCap) : 0;
          const remainingEditPotential = Math.max(0, Math.floor((1.0 - genUsage) * e.currentEditCap) - editAssigned);
          return { id: e.id, potential: remainingEditPotential };
        }).filter(p => p.potential > 0);

        if (potentials.length === 0) break;

        const totalPotential = potentials.reduce((sum, p) => sum + p.potential, 0);
        const batchToAssign = Math.min(remainingToAssign, totalPotential);
        let batchAssigned = 0;

        potentials.forEach((p, index) => {
          let share = Math.floor(batchToAssign * (p.potential / totalPotential));
          if (share === 0 && index === 0 && batchAssigned < batchToAssign) share = 1;
          share = Math.min(share, p.potential, batchToAssign - batchAssigned);
          dailyAssignments[p.id].edits += share;
          batchAssigned += share;
        });

        assigned += batchAssigned;
        if (batchAssigned === 0) break;
        iterations++;
      }
      return assigned;
    };

    // Prioritize editing work that is ready
    const editsFromBacklog = distributeEdits(aiReadyToEditQueue, editors);
    aiReadyToEditQueue -= editsFromBacklog;
    dailyTotalEdit += editsFromBacklog;

    // Check editors who can do same-day edits (edits of gens created today)
    const sameDayEds = editors.filter(e => e.limitations?.toLowerCase().includes("same-day"));
    const sameDayCompleted = distributeEdits(dailyTotalGen, sameDayEds);
    dailyTotalEdit += sameDayCompleted;

    const normalEditsToday = distributeEdits(remainingNormalEdits, editors);
    remainingNormalEdits -= normalEditsToday;
    dailyTotalEdit += normalEditsToday;

    // --- FINALIZE DAY ---
    totalGensCompleted += dailyTotalGen;
    totalEditsCompleted += dailyTotalEdit;
    // Videos generated today become available for edit tomorrow (unless handled by same-day logic)
    aiReadyToEditQueue += (dailyTotalGen - sameDayCompleted);

    const finalAssignments = Object.values(dailyAssignments);

    if (dailyTotalGen < remainingGens && dailyTotalEdit >= (aiReadyToEditQueue + remainingNormalEdits)) {
      genBottleneckDays++;
    } else if (dailyTotalEdit < (aiReadyToEditQueue + remainingNormalEdits)) {
      editBottleneckDays++;
    }

    schedule.push({
      day,
      assignments: finalAssignments,
      dailyTotalGen,
      dailyTotalEdit
    });

    day++;
  }

  const daysAvailable = schedule.length;
  const feasible = workload.deadlineDays === 0 || daysAvailable <= workload.deadlineDays;
  
  return {
    summary: {
      totalGenerations: totalGensCompleted,
      totalEdits: totalEditsCompleted,
      daysAvailable: daysAvailable,
      feasible: feasible,
      feasibilityReason: feasible ? undefined : `Completion in ${daysAvailable} days exceeds deadline of ${workload.deadlineDays}.`,
      videosPendingAfterDay4: 0
    },
    bottlenecks: {
      generation: genBottleneckDays > editBottleneckDays,
      editing: editBottleneckDays >= genBottleneckDays,
      limitingRole: genBottleneckDays > editBottleneckDays ? "Interns (Gen Cap)" : "Editors (Edit Cap)"
    },
    schedule,
    constraints: [
      `Project: ${workload.projectName}`,
      `Strategy: Balanced Pacing`,
      "Algorithm: Heuristic with Pacing",
    ],
    risks: feasible ? [] : ["Project duration is longer than the deadline."]
  };
};

// --- SMART AI ALGORITHM ---
// Uses Gemini to interpret text feedback and generate plans
const generateSmartPlan = async (
  apiKey: string,
  workers: Worker[],
  workload: Workload,
  leaves: Record<string, number[]> = {},
  startDay: number = 1
): Promise<ProductionPlan> => {
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Enriched prompt with better context and strict logic hierarchy
  const prompt = `
    You are an expert Production Manager AI for a video editing team.
    Your Goal: Create an optimal, realistic, and efficient daily schedule starting from Day ${startDay}.

    CONTEXT:
    - Project: "${workload.projectName}"
    - Timeline: ${workload.startDate} to ${workload.endDate} (${workload.deadlineDays} days).
    - STARTING DAY: Day ${startDay}. (Do not schedule anything for Days 1 to ${startDay - 1}).
    - Remaining Workload to Schedule: 
      1. ${workload.aiVideos} AI Videos (Must be Generated first, then Edited).
      2. ${workload.normalVideos} Videos Ready to Edit (These can be Normal videos or AI videos generated in previous days).
    
    RESOURCES (Daily Capacity):
    ${workers.map(w => 
      `- ${w.name} (${w.role}): GenCap=${w.genCapacity}, EditCap=${w.editCapacity}. Limits: ${w.limitations || 'None'}`
    ).join('\n')}
    
    LEAVES (Worker Unavailable):
    ${JSON.stringify(leaves)}
    
    --------------------------------------------------------
    STRICT RULES (Must be followed in order):
    
    1. ROLE STRATEGY:
       - **INTERN PACING (CRITICAL)**: 
           - Do NOT simply cram all generations into Day ${startDay} if there is plenty of time left.
           - **Spread out generation work evenly** for Interns across the remaining days to create a sustainable workflow.
           - Example: If 20 videos need generating and 4 days remain, assign ~5 per day, rather than 20 on Day 1.
       - **EDITOR RESTRICTION**: 
           - **NEVER** assign a generation to an Editor if an Intern can do it on a future day before the deadline.
           - It is better to have Editors **IDLE (0 Work)** today than to give them Generations that an Intern could do tomorrow.
           - Editors should ONLY do Generations if the deadline is impossible to meet with Interns alone.

    2. CAPACITY & PHYSICAL LAWS:
       - Workers cannot exceed daily caps.
       - Mixed Work: (AssignedGen / GenCap) + (AssignedEdit / EditCap) <= 1.0.
       - Leaves: Workers on leave must have 0 output.
       
    3. FLOW CONSTRAINT:
       - You cannot edit a video that doesn't exist yet.
       - Cumulative Edits (End of Day X) <= (Cumulative Generations (End of Day X) + ${workload.normalVideos}).

    --------------------------------------------------------
    
    Generate a JSON plan.
    
    Output Format (JSON Only):
    {
      "schedule": [
        {
          "day": ${startDay},
          "assignments": [
             { "workerId": "...", "person": "...", "role": "...", "generations": 0, "edits": 0, "isOnLeave": false }
          ]
        }
      ],
      "risks": ["List compromised rules or capacity issues here"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        // Fallback cleanup if markdown code blocks exist
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanText);
    }
    
    const schedule = result.schedule as DayPlan[];
    let totalGens = 0;
    let totalEdits = 0;
    
    schedule.forEach(day => {
      day.dailyTotalGen = 0;
      day.dailyTotalEdit = 0;
      day.assignments.forEach(task => {
        // Sanity check to ensure numbers
        task.generations = Number(task.generations) || 0;
        task.edits = Number(task.edits) || 0;
        
        day.dailyTotalGen += task.generations;
        day.dailyTotalEdit += task.edits;
        totalGens += task.generations;
        totalEdits += task.edits;
      });
    });

    const daysAvailable = schedule.length;
    const feasible = daysAvailable <= (workload.deadlineDays || 100);

    return {
      summary: {
        totalGenerations: totalGens,
        totalEdits: totalEdits,
        daysAvailable,
        feasible,
        feasibilityReason: result.risks?.join(' ') || (feasible ? undefined : "Deadline exceeded.")
      },
      bottlenecks: {
        generation: false, 
        editing: false,
        limitingRole: "AI Determined"
      },
      schedule,
      constraints: [
        `AI Model: Gemini 3 Pro`,
        `Strategy: Sustainable Pacing`,
        `Rule: Even Distribution`
      ],
      risks: result.risks || []
    };

  } catch (error) {
    console.error("AI Generation failed", error);
    throw new Error("AI Generation failed. Ensure API Key is valid.");
  }
};

// --- MAIN EXPORT ---
export const generateProductionPlan = async (
  workers: Worker[],
  workload: Workload,
  leaves: Record<string, number[]> = {},
  apiKey?: string,
  startDay: number = 1
): Promise<ProductionPlan> => {
  if (apiKey) {
    return generateSmartPlan(apiKey, workers, workload, leaves, startDay);
  } else {
    return generateHeuristicPlan(workers, workload, leaves, startDay);
  }
};

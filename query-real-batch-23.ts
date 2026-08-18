import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

const normalizeToken = (s: string) => {
  const str = s.trim();
  if (!str) return null;
  const match = str.match(/^0*(\d+)([a-zA-Z]?)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (isNaN(n)) return null;
  const v = match[2].toLowerCase();
  return { raw: str, num: n, key: v ? `${n}${v}` : `${n}`, ver: v };
};

const parseDummies = (dummyStr?: string) => {
  const set = new Set<number>();
  if (!dummyStr) return set;
  dummyStr.trim().split(/[\s,]+/).forEach(s => {
    const n = parseInt(s, 10);
    if (!isNaN(n)) set.add(n);
  });
  return set;
};

const parseNormalRows = (normalStr?: string) => {
  const set = new Set<number>();
  if (!normalStr) return set;
  normalStr.trim().split(/[\s,]+/).forEach(s => {
    const n = parseInt(s, 10);
    if (!isNaN(n)) set.add(n);
  });
  return set;
};

async function run() {
  try {
    const snapshot = await getDocs(collection(db, 'production_plans'));
    console.log(`Found ${snapshot.size} plans in DB.`);
    
    for (const planDoc of snapshot.docs) {
      const plan = planDoc.data();
      const batches = plan.batches || [];
      
      const targetBatch = batches.find((b: any) => 
        b.id.toLowerCase().includes('23') || 
        b.batchName.toLowerCase().includes('23') || 
        (b.id.toLowerCase().includes('kan') || b.batchName.toLowerCase().includes('kan'))
      );
      
      if (targetBatch) {
        console.log(`\n======================================`);
        console.log(`PLAN ID: ${planDoc.id}`);
        console.log(`PROJECT NAME: ${plan.projectName}`);
        console.log(`======================================`);
        console.log(`Batch: ${targetBatch.batchName} (${targetBatch.id})`);
        console.log(`Language: ${targetBatch.language}`);
        console.log(`Status: ${targetBatch.status}`);
        console.log(`Row Range: ${targetBatch.startRow} to ${targetBatch.endRow}`);
        console.log(`Dummy Rows: "${targetBatch.dummyRows || ''}"`);
        console.log(`Normal Rows: "${targetBatch.normalRows || ''}"`);
        
        // Let's load days and assignments subcollection correctly!
        const daysColRef = collection(planDoc.ref, 'days');
        const daysSnapshot = await getDocs(daysColRef);
        console.log(`Found ${daysSnapshot.size} days in days subcollection.`);
        
        const completedGenRows = new Set<string>();
        const completedEditRows = new Set<string>();
        const completedNormalRows = new Set<string>();
        
        const dummySet = parseDummies(targetBatch.dummyRows);
        const normalSet = parseNormalRows(targetBatch.normalRows);
        
        for (const dayDoc of daysSnapshot.docs) {
          const dayData = dayDoc.data();
          const assignmentsColRef = collection(dayDoc.ref, 'assignments');
          const assignmentsSnapshot = await getDocs(assignmentsColRef);
          
          const assignments = assignmentsSnapshot.docs.map(a => a.data());
          // Also merge with any assignments on the dayData itself if present
          const allAssignments = [...(dayData.assignments || []), ...assignments];
          
          allAssignments.forEach((task: any) => {
            if (task.batchId === targetBatch.id) {
              const status = task.status || "Completed";
              const genStr = task.assignedGenRows || "";
              const editStr = task.assignedEditRows || "";
              
              console.log(`  Day ${dayData.day} - ${task.person} (${task.role}): Status="${status}" | Gen="${genStr}" | Edit="${editStr}"`);
              
              if (status === "Completed") {
                if (genStr) {
                  genStr.trim().split(/[\s,]+/).forEach((s: string) => {
                    const t = normalizeToken(s);
                    if (t && !dummySet.has(t.num)) {
                      completedGenRows.add(t.key);
                    }
                  });
                }
                if (editStr) {
                  editStr.trim().split(/[\s,]+/).forEach((s: string) => {
                    const t = normalizeToken(s);
                    if (t && !dummySet.has(t.num)) {
                      if (!t.ver && normalSet.has(t.num)) {
                        completedNormalRows.add(t.key);
                      } else {
                        completedEditRows.add(t.key);
                      }
                    }
                  });
                }
              }
            }
          });
        }
        
        // Physical pending/completed calculations
        const start = targetBatch.startRow !== undefined ? targetBatch.startRow : 2;
        const end = targetBatch.endRow !== undefined ? targetBatch.endRow : 100;
        
        const doneRowsList: number[] = [];
        const pendingGenList: string[] = [];
        const pendingEditList: string[] = [];
        const pendingNormalList: number[] = [];
        
        for (let i = start; i <= end; i++) {
          if (dummySet.has(i)) {
            continue;
          }
          
          if (normalSet.has(i)) {
            if (completedNormalRows.has(`${i}`)) {
              doneRowsList.push(i);
            } else {
              pendingNormalList.push(i);
            }
          } else {
            // AI row
            const isGenDone = completedGenRows.has(`${i}`) || completedGenRows.has(`${i}h`) || completedGenRows.has(`${i}v`) || completedGenRows.has(`${i}s`);
            const hasBaseEdit = completedEditRows.has(`${i}`);
            
            let isEditDone = false;
            if (targetBatch.horizontalVersions || targetBatch.verticalVersions || targetBatch.squareVersions) {
              if (hasBaseEdit) {
                isEditDone = true;
              } else {
                let allVersionsDone = true;
                if (targetBatch.horizontalVersions && !completedEditRows.has(`${i}h`)) allVersionsDone = false;
                if (targetBatch.verticalVersions && !completedEditRows.has(`${i}v`)) allVersionsDone = false;
                if (targetBatch.squareVersions && !completedEditRows.has(`${i}s`)) allVersionsDone = false;
                isEditDone = allVersionsDone;
              }
            } else {
              if (hasBaseEdit) {
                isEditDone = true;
              }
            }
            
            if (isGenDone && isEditDone) {
              doneRowsList.push(i);
            } else {
              if (!isGenDone) {
                pendingGenList.push(`${i}`);
              }
              if (!isEditDone) {
                const pendingVers: string[] = [];
                if (targetBatch.horizontalVersions && !completedEditRows.has(`${i}h`)) pendingVers.push(`${i}h`);
                if (targetBatch.verticalVersions && !completedEditRows.has(`${i}v`)) pendingVers.push(`${i}v`);
                if (targetBatch.squareVersions && !completedEditRows.has(`${i}s`)) pendingVers.push(`${i}s`);
                if (pendingVers.length > 0) {
                  pendingEditList.push(...pendingVers);
                } else if (!hasBaseEdit) {
                  pendingEditList.push(`${i}`);
                }
              }
            }
          }
        }
        
        console.log(`\nRow Progress Breakdown:`);
        console.log(`  Completed Rows (${doneRowsList.length}):`, doneRowsList.length > 0 ? doneRowsList.join(', ') : 'None');
        console.log(`  Pending Normal Rows (${pendingNormalList.length}):`, pendingNormalList.length > 0 ? pendingNormalList.join(', ') : 'None');
        console.log(`  Pending Gen Rows (${pendingGenList.length}):`, pendingGenList.length > 0 ? pendingGenList.join(', ') : 'None');
        console.log(`  Pending Edit Rows (${pendingEditList.length}):`, pendingEditList.length > 0 ? pendingEditList.join(', ') : 'None');
        
        console.log(`\nCompleted Gen Row Keys Set:`, Array.from(completedGenRows).join(', '));
        console.log(`Completed Edit Row Keys Set:`, Array.from(completedEditRows).join(', '));
        console.log(`Completed Normal Row Keys Set:`, Array.from(completedNormalRows).join(', '));
      }
    }
  } catch (err) {
    console.error("Execution error:", err);
  }
  process.exit(0);
}

run();

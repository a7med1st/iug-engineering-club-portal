"use client";

import { useId, useState } from "react";

export default function ActivityDepartmentChips({ names }: { names: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const extraId = useId();
  const remaining = names.slice(2);

  return (
    <div className="past-activity-departments" aria-label="الأقسام المستهدفة">
      {names.slice(0, 2).map((name, index) => <span className="past-activity-department" key={`${index}-${name}`}>{name}</span>)}
      {remaining.length > 0 && <>
        <span id={extraId} className="past-activity-extra-departments" hidden={!expanded}>
          {remaining.map((name, index) => <span className="past-activity-department" key={`${index}-${name}`}>{name}</span>)}
        </span>
        <button type="button" className="past-activity-department past-activity-department-toggle" aria-expanded={expanded} aria-controls={extraId} onClick={() => setExpanded(!expanded)}>
          {expanded ? "عرض أقل" : <><bdi dir="ltr">+{remaining.length}</bdi> أقسام</>}
        </button>
      </>}
    </div>
  );
}

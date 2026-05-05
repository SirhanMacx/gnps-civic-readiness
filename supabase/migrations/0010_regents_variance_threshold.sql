-- NYSED FAQ current as of May 2026: students eligible for 55-64 safety nets
-- and 45 variances earn one Civic Knowledge point per applicable Regents exam.
-- The existing safety_net_applied boolean now represents any approved
-- safety-net, special-appeal, or 45-variance case supplied by IC/import.

create or replace function public.regents_proficiency(score smallint, safety_net boolean)
returns proficiency_level language sql immutable as $$
  select case
    when score >= 85 then 'mastery'::proficiency_level
    when score between 65 and 84 then 'proficiency'::proficiency_level
    when safety_net and score between 45 and 64 then 'safety_net_pass'::proficiency_level
    else 'below'::proficiency_level
  end;
$$;

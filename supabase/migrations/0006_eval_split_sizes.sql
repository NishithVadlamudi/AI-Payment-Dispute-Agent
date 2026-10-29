begin;
-- The full development dataset remains 30–50 cases in application validation;
-- separately frozen holdout splits can be smaller and retain their own hash.
alter table public.eval_reports drop constraint eval_reports_dataset_size_check;
alter table public.eval_reports add constraint eval_reports_dataset_size_check
  check (dataset_size between 1 and 50);
commit;

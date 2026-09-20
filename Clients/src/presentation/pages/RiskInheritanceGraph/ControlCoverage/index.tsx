/**
 * @fileoverview F8 — control coverage gaps.
 *
 * Read-only. The backend puts every active risk in exactly one of three
 * states, and only one of them is a finding:
 *
 *   covered       — at least one link to a control
 *   gap           — no control link, but a project with a framework attached,
 *                   so there was something to map to and nobody did
 *   no_framework  — nothing to map to yet; not a finding
 *
 * The two lists are kept apart on purpose, because merging them would report
 * unstarted projects as audit failures. `assessment_link_count` is shown as
 * context and never moves a risk between lists: a risk linked only to a
 * questionnaire answer is still uncovered.
 *
 * Owns its own fetch and loading/error/empty state, like the sibling sections.
 */

import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AlertCircle, ChevronDown, Info, ShieldCheck } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import Chip from "../../../components/Chip";
import singleTheme from "../../../themes/v1SingleTheme";
import { getControlCoverage } from "../../../../application/repository/riskLink.repository";
import type { CoverageGapRisk, CoverageReport } from "../../../../domain/interfaces/i.riskLink";
import { useOwnerName } from "../useOwnerName";
import {
  sectionSx,
  summaryTitleSx,
  blockHeadingSx,
  captionSx,
  tableSx,
  tableHeadRowSx,
  tableHeadCellSx,
  tableBodyRowSx,
  tableBodyCellSx,
  stateContainerSx,
  errorAlertSx,
  errorTextSx,
} from "../DismissalAnalytics/styles";
import {
  wrapCellSx,
  numericCellSx,
  riskNameSx,
  riskMetaSx,
  infoAlertSx,
  successAlertSx,
  alertTextSx,
  summaryGridSx,
  summaryTileSx,
  summaryLabelSx,
  summaryValueSx,
} from "../reportStyles";

/**
 * A risk can sit in several projects at once, only some of which have a
 * framework. In the gaps list that difference is the reason the risk is a
 * finding, so it is spelled out; in the no-framework list every project lacks
 * one and repeating it on every row is noise.
 */
export function projectsText(
  projects: CoverageGapRisk["projects"],
  markFrameworks: boolean,
): string {
  if (projects.length === 0) return "—";
  return projects
    .map((project) =>
      markFrameworks && !project.has_framework ? `${project.name} (no framework)` : project.name,
    )
    .join(", ");
}

/** Each list is capped server-side, so the heading says what is on screen. */
export function listHeading(label: string, shown: number, total: number): string {
  return shown < total
    ? `${label} (${shown.toLocaleString()} of ${total.toLocaleString()})`
    : `${label} (${total.toLocaleString()})`;
}

const ControlCoverage: React.FC = () => {
  const [data, setData] = useState<CoverageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ownerName = useOwnerName();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await getControlCoverage();
        if (mounted) setData(payload);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to fetch control coverage");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const renderTable = (rows: CoverageGapRisk[], markFrameworks: boolean) => (
    <TableContainer>
      <Table sx={tableSx}>
        <TableHead sx={{ backgroundColor: singleTheme.tableStyles.primary.header.backgroundColors }}>
          <TableRow sx={tableHeadRowSx}>
            <TableCell sx={tableHeadCellSx}>Risk</TableCell>
            <TableCell sx={tableHeadCellSx}>Level</TableCell>
            <TableCell sx={tableHeadCellSx}>Mitigation status</TableCell>
            <TableCell sx={tableHeadCellSx}>Projects</TableCell>
            <TableCell sx={tableHeadCellSx}>Assessment links</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} sx={tableBodyRowSx}>
              <TableCell sx={tableBodyCellSx}>
                <Typography sx={riskNameSx}>{row.risk_name}</Typography>
                <Typography sx={riskMetaSx}>
                  #{row.id} · {ownerName(row.risk_owner)}
                </Typography>
              </TableCell>
              <TableCell sx={tableBodyCellSx}>
                {row.risk_level ? <Chip label={row.risk_level} size="small" /> : "—"}
              </TableCell>
              <TableCell sx={tableBodyCellSx}>
                {row.mitigation_status ? (
                  <Chip label={row.mitigation_status} size="small" />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell sx={wrapCellSx}>{projectsText(row.projects, markFrameworks)}</TableCell>
              <TableCell sx={numericCellSx}>{row.assessment_link_count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <Box sx={stateContainerSx}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={errorAlertSx} role="alert">
          <AlertCircle size={16} />
          <Typography sx={errorTextSx}>{error}</Typography>
        </Box>
      );
    }

    if (!data || data.summary.total_active_risks === 0) {
      return (
        <EmptyState
          icon={ShieldCheck}
          message="No active risks to check for control coverage yet."
          showBorder={false}
        />
      );
    }

    const { summary, gaps, no_framework: noFramework } = data;

    return (
      <>
        <Box sx={summaryGridSx}>
          <Box sx={summaryTileSx}>
            <Typography sx={summaryLabelSx}>Active risks</Typography>
            <Typography sx={summaryValueSx}>
              {summary.total_active_risks.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={summaryTileSx}>
            <Typography sx={summaryLabelSx}>Covered by a control</Typography>
            <Typography sx={summaryValueSx}>{summary.covered.toLocaleString()}</Typography>
          </Box>
          <Box sx={summaryTileSx}>
            <Typography sx={summaryLabelSx}>Coverage gaps</Typography>
            <Typography sx={summaryValueSx}>{summary.gap.toLocaleString()}</Typography>
          </Box>
          <Box sx={summaryTileSx}>
            <Typography sx={summaryLabelSx}>No framework yet</Typography>
            <Typography sx={summaryValueSx}>{summary.no_framework.toLocaleString()}</Typography>
          </Box>
        </Box>

        {data.truncated && (
          <Box sx={infoAlertSx} role="status">
            <Info size={16} />
            <Typography sx={alertTextSx}>
              More risks matched than a single report lists. The counts above are complete; the
              tables below show the worst of each list.
            </Typography>
          </Box>
        )}

        {summary.gap === 0 && summary.no_framework === 0 ? (
          <Box sx={successAlertSx} role="status">
            <ShieldCheck size={16} />
            <Typography sx={alertTextSx}>
              Every active risk is linked to at least one control.
            </Typography>
          </Box>
        ) : (
          <>
            {gaps.length > 0 && (
              <>
                <Typography sx={blockHeadingSx}>
                  {listHeading("Coverage gaps", gaps.length, summary.gap)}
                </Typography>
                <Typography sx={captionSx}>
                  These risks sit in a project that has a framework attached but are not linked to
                  any control. Assessment links are shown for context and do not count as coverage.
                </Typography>
                {renderTable(gaps, true)}
              </>
            )}

            {noFramework.length > 0 && (
              <>
                <Typography sx={blockHeadingSx}>
                  {listHeading("No framework yet", noFramework.length, summary.no_framework)}
                </Typography>
                <Typography sx={captionSx}>
                  None of these risks' projects has a framework attached, so there are no controls
                  to map to. Not a finding — attach a framework first.
                </Typography>
                {renderTable(noFramework, false)}
              </>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <Accordion defaultExpanded={false} sx={sectionSx}>
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Typography sx={summaryTitleSx}>Control coverage</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 8 }}>{renderBody()}</AccordionDetails>
    </Accordion>
  );
};

export default ControlCoverage;

/**
 * @fileoverview F7 — duplicate risk candidates.
 *
 * Read-only: the backend scores pairs of risks in the same category by the
 * overlap of their name and description words and reports the pairs above the
 * threshold. It writes nothing and merges nothing — a pair here is a prompt to
 * go and look, not a decision. The columns exist so a reader can judge that
 * prompt without leaving the page: the score, the words the two risks actually
 * share, and what else they have in common.
 *
 * Owns its own fetch and loading/error/empty state, like the sibling sections:
 * a failed graph fetch must never hide a report that renders fine.
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
import { AlertCircle, ChevronDown, CopyCheck, Info } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import singleTheme from "../../../themes/v1SingleTheme";
import { getDuplicateCandidates } from "../../../../application/repository/riskLink.repository";
import type { DuplicateReport } from "../../../../domain/interfaces/i.riskLink";
import { useOwnerName } from "../useOwnerName";
import {
  sectionSx,
  summaryTitleSx,
  captionSx,
  tableSx,
  tableHeadRowSx,
  tableHeadCellSx,
  tableBodyRowSx,
  tableBodyCellSx,
  stateContainerSx,
  errorAlertSx,
  errorTextSx,
  rateCellSx,
  barTrackSx,
  barFillSx,
} from "../DismissalAnalytics/styles";
import {
  wrapCellSx,
  riskNameSx,
  riskMetaSx,
  metricLabelSx,
  infoAlertSx,
  alertTextSx,
} from "../reportStyles";

/**
 * A pair can share dozens of words. Past a handful the list stops being read
 * and starts being scrolled, so the rest is counted instead.
 */
const MAX_SHOWN_TERMS = 6;

export function summariseTerms(items: string[]): string {
  if (items.length === 0) return "—";
  if (items.length <= MAX_SHOWN_TERMS) return items.join(", ");
  return `${items.slice(0, MAX_SHOWN_TERMS).join(", ")} +${items.length - MAX_SHOWN_TERMS} more`;
}

/** The API sends a 0–1 ratio; the column is read as a percentage. */
export function similarityPercent(similarity: number): number {
  return Math.round(similarity * 100);
}

const DuplicateCandidates: React.FC = () => {
  const [data, setData] = useState<DuplicateReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ownerName = useOwnerName();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await getDuplicateCandidates();
        if (mounted) setData(payload);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to fetch duplicate candidates");
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

    if (!data || data.candidates.length === 0) {
      // No pairs is the good outcome, not a missing report — but it only means
      // anything once something was actually scanned.
      return (
        <EmptyState
          icon={CopyCheck}
          message={
            !data || data.scanned === 0
              ? "No risks to scan yet."
              : `No likely duplicates. ${data.compared.toLocaleString()} pairs compared and none scored above the threshold.`
          }
          showBorder={false}
        />
      );
    }

    return (
      <>
        <Typography sx={captionSx}>
          {data.scanned.toLocaleString()} risks scanned, {data.compared.toLocaleString()} pairs
          compared in the same category. Scores are the share of words the two risks have in
          common — a prompt to compare them, not a merge.
        </Typography>

        {data.truncated && (
          <Box sx={infoAlertSx} role="status">
            <Info size={16} />
            <Typography sx={alertTextSx}>
              This scan hit its size limit, so the list below is a sample rather than every pair in
              the organization.
            </Typography>
          </Box>
        )}

        <TableContainer>
          <Table sx={tableSx}>
            <TableHead
              sx={{ backgroundColor: singleTheme.tableStyles.primary.header.backgroundColors }}
            >
              <TableRow sx={tableHeadRowSx}>
                <TableCell sx={tableHeadCellSx}>Risk</TableCell>
                <TableCell sx={tableHeadCellSx}>Possible duplicate of</TableCell>
                <TableCell sx={tableHeadCellSx}>Similarity</TableCell>
                <TableCell sx={tableHeadCellSx}>Words in common</TableCell>
                <TableCell sx={tableHeadCellSx}>Also shares</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.candidates.map((candidate) => {
                const percent = similarityPercent(candidate.similarity);
                return (
                  <TableRow
                    key={`${candidate.risk_a.id}-${candidate.risk_b.id}`}
                    sx={tableBodyRowSx}
                  >
                    <TableCell sx={tableBodyCellSx}>
                      <Typography sx={riskNameSx}>{candidate.risk_a.risk_name}</Typography>
                      <Typography sx={riskMetaSx}>
                        #{candidate.risk_a.id} · {ownerName(candidate.risk_a.risk_owner)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <Typography sx={riskNameSx}>{candidate.risk_b.risk_name}</Typography>
                      <Typography sx={riskMetaSx}>
                        #{candidate.risk_b.id} · {ownerName(candidate.risk_b.risk_owner)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <Box sx={rateCellSx}>
                        <Box sx={barTrackSx}>
                          <Box sx={barFillSx(percent)} />
                        </Box>
                        <Typography sx={metricLabelSx} aria-label={`${percent} percent similar`}>
                          {percent}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={wrapCellSx}>
                      {summariseTerms(candidate.shared_tokens)}
                    </TableCell>
                    <TableCell sx={wrapCellSx}>{summariseTerms(candidate.also_shares)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  };

  return (
    <Accordion defaultExpanded={false} sx={sectionSx}>
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Typography sx={summaryTitleSx}>Duplicate candidates</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 8 }}>{renderBody()}</AccordionDetails>
    </Accordion>
  );
};

export default DuplicateCandidates;

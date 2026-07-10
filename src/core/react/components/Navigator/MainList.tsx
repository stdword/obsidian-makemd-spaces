import { SpaceTreeComponent } from "core/react/components/Navigator/SpaceTree/SpaceTreeView";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { useEffect } from "react";
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary";
import { FocusSelector } from "./Focuses/FocusSelector";

export const MainList = (props: { superstate: Superstate }) => {
    const [indexing, setIndexing] = React.useState(false);

    useEffect(() => {
        const reindex = async () => {
            setIndexing(true);
        };
        const finishedIndex = async () => {
            setIndexing(false);
        };
        props.superstate.eventsDispatcher.addListener("superstateReindex", reindex);
        props.superstate.eventsDispatcher.addListener("superstateUpdated", finishedIndex);
        return () => {
            props.superstate.eventsDispatcher.removeListener("superstateReindex", reindex);
            props.superstate.eventsDispatcher.removeListener("superstateUpdated", finishedIndex);
        };
    }, []);
    return (
        <>
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className="mk-progress-bar">{indexing && <div className="mk-progress-bar-value"></div>}</div>
                <FocusSelector superstate={props.superstate}></FocusSelector>

                <SpaceTreeComponent superstate={props.superstate} />
            </ErrorBoundary>
        </>
    );
};

export function ErrorFallback({ error }: { error: Error }) {
    const { resetBoundary } = useErrorBoundary();

    const copyError = () => {
        navigator.clipboard.writeText(error.message);
    };
    return (
        <div role="alert">
            <p>{i18n.notice.somethingWentWrong}</p>
            <p style={{ color: "red" }}>{error.message}</p>
            <button onClick={copyError}>{i18n.notice.copyError}</button>
            <button onClick={resetBoundary}>{i18n.notice.reload}</button>
        </div>
    );
}
